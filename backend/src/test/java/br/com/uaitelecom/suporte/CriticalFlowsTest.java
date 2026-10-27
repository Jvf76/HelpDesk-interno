package br.com.uaitelecom.suporte;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class CriticalFlowsTest {
  static final String PASSWORD = Security.token();
  static String passwordHash;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry p) {
    p.add(
        "spring.datasource.url",
        () ->
            System.getenv()
                .getOrDefault(
                    "UAI_TEST_DATABASE",
                    "jdbc:h2:mem:uai;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"));
    p.add(
        "spring.datasource.username", () -> System.getenv().getOrDefault("UAI_TEST_DB_USER", "sa"));
    p.add(
        "spring.datasource.password",
        () -> System.getenv().getOrDefault("UAI_TEST_DB_PASSWORD", ""));
    p.add("uai.bootstrap-login", () -> "bootstrap");
    p.add("uai.bootstrap-password", () -> PASSWORD);
    p.add("uai.secure-cookie", () -> false);
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired Db db;
  @Autowired SessionService service;
  @Autowired BCryptPasswordEncoder passwords;
  @MockitoBean MeshEngine engine;
  UUID admin, tech, alice, bob, device;
  Account adminAccount, techAccount, aliceAccount, bobAccount;

  record Account(UUID id, Cookie cookie, String csrf, String hash, String role) {
    Security.Actor actor() {
      return new Security.Actor(id, "Teste", role, hash);
    }
  }

  @BeforeEach
  void setup() {
    for (String table :
        List.of(
            "audit_event",
            "remote_session",
            "ticket_event",
            "ticket",
            "device_permission",
            "device",
            "user_session",
            "app_user",
            "login_attempt")) db.exec("DELETE FROM " + table);
    if (passwordHash == null) passwordHash = passwords.encode(PASSWORD);
    admin = user("admin", "ADMIN");
    tech = user("tech", "TECNICO");
    alice = user("alice", "SOLICITANTE");
    bob = user("bob", "SOLICITANTE");
    adminAccount = account(admin, "ADMIN");
    techAccount = account(tech, "TECNICO");
    aliceAccount = account(alice, "SOLICITANTE");
    bobAccount = account(bob, "SOLICITANTE");
    device = UUID.randomUUID();
    db.exec(
        "INSERT INTO device (id,name,location,department,owner_id,last_seen,mesh_node,agent_hash)"
            + " VALUES (?,'PC','Matriz','NOC',?,?,?,?)",
        device,
        alice,
        OffsetDateTime.now(),
        "node//testnode",
        Security.hash("test-agent-identity"));
    when(engine.enabled()).thenReturn(true);
    when(engine.observe(anyString(), anyBoolean(), anyBoolean()))
        .thenReturn(new RemoteEngine.Observation("READY", null, null, null));
    when(engine.create(anyString(), anyString(), anyBoolean()))
        .thenReturn(
            new RemoteEngine.Share("test-share", "https://remote.invalid/sharing?c=test-only"));
  }

  UUID user(String login, String role) {
    var id = UUID.randomUUID();
    db.exec("INSERT INTO app_user VALUES (?,?,?,?,?,TRUE)", id, login, login, passwordHash, role);
    return id;
  }

  Account account(UUID id, String role) {
    String token = Security.token(), csrf = Security.token();
    db.exec(
        "INSERT INTO user_session VALUES (?,?,?,?)",
        Security.hash(token),
        id,
        csrf,
        OffsetDateTime.now().plusHours(1));
    return new Account(id, new Cookie("UAI_SESSION", token), csrf, Security.hash(token), role);
  }

  MockHttpServletRequestBuilder req(String method, String path, Account a, Object body)
      throws Exception {
    var builder =
        switch (method) {
          case "POST" -> post(path);
          case "PUT" -> put(path);
          case "DELETE" -> delete(path);
          default -> get(path);
        };
    builder.cookie(a.cookie()).header("X-CSRF-Token", a.csrf());
    if (body != null) builder.contentType("application/json").content(json.writeValueAsBytes(body));
    return builder;
  }

  JsonNode result(ResultActions result) throws Exception {
    return json.readTree(result.andReturn().getResponse().getContentAsString());
  }

  UUID ticket(Account a) throws Exception {
    return UUID.fromString(
        result(
                mvc.perform(
                        req(
                            "POST",
                            "/api/tickets",
                            a,
                            Map.of(
                                "title",
                                "Sem rede",
                                "description",
                                "Sem conexão",
                                "category",
                                "Rede",
                                "priority",
                                "NORMAL")))
                    .andExpect(status().isOk()))
            .path("id")
            .asText());
  }

  UUID request(Account a, String mode) {
    return (UUID) service.request(a.actor(), device, mode, null).get("id");
  }

  void grant(boolean control) {
    db.exec("INSERT INTO device_permission VALUES (?,?,?)", device, tech, control);
  }

  @Test
  void requesterCannotReadOrCommentOnOthersTicket() throws Exception {
    UUID id = ticket(aliceAccount);
    mvc.perform(req("GET", "/api/tickets/" + id, bobAccount, null))
        .andExpect(status().isForbidden());
    mvc.perform(req("POST", "/api/tickets/" + id + "/comments", bobAccount, Map.of("body", "x")))
        .andExpect(status().isForbidden());
    assertEquals(0, result(mvc.perform(req("GET", "/api/tickets", bobAccount, null))).size());
  }

  @Test
  void requesterCannotEscalatePrivileges() throws Exception {
    mvc.perform(
            req(
                "POST",
                "/api/users",
                aliceAccount,
                Map.of(
                    "name", "Intruso", "login", "intruso", "password", PASSWORD, "role", "ADMIN")))
        .andExpect(status().isForbidden());
    mvc.perform(
            req(
                "POST",
                "/api/sessions",
                aliceAccount,
                Map.of("deviceId", device, "mode", "CONTROL")))
        .andExpect(status().isForbidden());
    verify(engine, never()).create(anyString(), anyString(), anyBoolean());
  }

  @Test
  void technicianWithoutPermissionCannotRequestControl() throws Exception {
    mvc.perform(
            req(
                "POST",
                "/api/sessions",
                techAccount,
                Map.of("deviceId", device, "mode", "CONTROL")))
        .andExpect(status().isForbidden());
    verify(engine, never()).create(anyString(), anyString(), anyBoolean());
  }

  @Test
  void viewPermissionCannotBeUpgradedToControl() throws Exception {
    grant(false);
    mvc.perform(
            req(
                "POST",
                "/api/sessions",
                techAccount,
                Map.of("deviceId", device, "mode", "CONTROL")))
        .andExpect(status().isForbidden());
    UUID id = request(techAccount, "VIEW");
    service.decide(device, id, "accept");
    service.launch(techAccount.actor(), id);
    verify(engine).create(anyString(), anyString(), eq(true));
  }

  @Test
  void rejectedSessionNeverIssuesRemoteLink() {
    grant(true);
    UUID id = request(techAccount, "CONTROL");
    service.decide(device, id, "reject");
    assertThrows(Exception.class, () -> service.launch(techAccount.actor(), id));
    verify(engine, never()).create(anyString(), anyString(), anyBoolean());
    assertEquals("REJECTED", service.get(techAccount.actor(), id).get("result"));
  }

  @Test
  void pendingSessionCannotIssueRemoteLink() {
    UUID id = request(adminAccount, "VIEW");
    assertThrows(Exception.class, () -> service.launch(adminAccount.actor(), id));
    verify(engine, never()).create(anyString(), anyString(), anyBoolean());
  }

  @Test
  void expiredSessionAndExpiredUserTokenAreRejected() throws Exception {
    UUID id = request(adminAccount, "VIEW");
    db.exec(
        "UPDATE remote_session SET expires_at=? WHERE id=?",
        OffsetDateTime.now().minusSeconds(1),
        id);
    assertThrows(Exception.class, () -> service.decide(device, id, "accept"));
    db.exec(
        "UPDATE user_session SET expires_at=? WHERE token_hash=?",
        OffsetDateTime.now().minusSeconds(1),
        adminAccount.hash());
    mvc.perform(req("GET", "/api/devices", adminAccount, null))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void localStopCallsEngineRevocationAndEndsRequest() {
    UUID id = request(adminAccount, "CONTROL");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    service.decide(device, id, "stop");
    verify(engine).remove("node//testnode", "test-share");
    assertEquals("LOCAL_STOP", service.get(adminAccount.actor(), id).get("result"));
    assertNotNull(service.get(adminAccount.actor(), id).get("ended_at"));
  }

  @Test
  void engineFailureDoesNotPretendSessionEnded() {
    UUID id = request(adminAccount, "CONTROL");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    doThrow(new RuntimeException()).when(engine).remove(anyString(), anyString());
    service.stop(adminAccount.actor(), id);
    assertEquals("STOPPING", service.get(adminAccount.actor(), id).get("status"));
    assertNull(service.get(adminAccount.actor(), id).get("ended_at"));
  }

  @Test
  void permissionRevocationClosesExistingShare() {
    grant(true);
    UUID id = request(techAccount, "CONTROL");
    service.decide(device, id, "accept");
    service.launch(techAccount.actor(), id);
    db.exec("DELETE FROM device_permission WHERE device_id=?", device);
    service.sweep();
    verify(engine).remove("node//testnode", "test-share");
    assertNotNull(service.get(techAccount.actor(), id).get("ended_at"));
  }

  @Test
  void offlineDevicesCannotStartSessionsAndAreMarkedOffline() throws Exception {
    db.exec(
        "UPDATE device SET last_seen=? WHERE id=?", OffsetDateTime.now().minusSeconds(31), device);
    assertThrows(Exception.class, () -> request(adminAccount, "VIEW"));
    var result = result(mvc.perform(req("GET", "/api/devices", adminAccount, null)));
    assertFalse(result.get(0).get("online").asBoolean());
    assertFalse(result.get(0).has("agent_hash"));
  }

  @Test
  void revokedAgentsCannotHeartbeat() throws Exception {
    mvc.perform(req("POST", "/api/devices/" + device + "/revoke", adminAccount, null))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/agent/heartbeat")
                .header("Authorization", "Bearer test-agent-identity")
                .contentType("application/json")
                .content("{\"os\":\"Windows\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void enrollmentIsSingleUseAndExpiredCodesFail() throws Exception {
    db.exec(
        "UPDATE device SET agent_hash=NULL,enrollment_hash=?,enrollment_expires=? WHERE id=?",
        Security.hash("single-use-code"),
        OffsetDateTime.now().plusMinutes(1),
        device);
    String body = "{\"code\":\"single-use-code\",\"os\":\"Windows\"}";
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body))
        .andExpect(status().isOk());
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body))
        .andExpect(status().isUnauthorized());
    db.exec(
        "UPDATE device SET agent_hash=NULL,enrollment_hash=?,enrollment_expires=? WHERE id=?",
        Security.hash("single-use-code"),
        OffsetDateTime.now().minusSeconds(1),
        device);
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void loginLogoutAndCsrf() throws Exception {
    var login =
        mvc.perform(
                post("/api/auth/login")
                    .contentType("application/json")
                    .content(
                        json.writeValueAsBytes(Map.of("login", "alice", "password", PASSWORD))))
            .andExpect(status().isOk())
            .andReturn();
    var cookie = login.getResponse().getCookie("UAI_SESSION");
    assertNotNull(cookie);
    assertTrue(cookie.isHttpOnly());
    var csrf = json.readTree(login.getResponse().getContentAsString()).path("csrf").asText();
    mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isForbidden());
    mvc.perform(post("/api/auth/logout").cookie(cookie).header("X-CSRF-Token", csrf))
        .andExpect(status().isOk());
    mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
  }

  @Test
  void repeatedLoginAttemptsAreLimited() throws Exception {
    String body = json.writeValueAsString(Map.of("login", "alice", "password", "invalid"));
    for (int i = 0; i < 10; i++)
      mvc.perform(post("/api/auth/login").contentType("application/json").content(body))
          .andExpect(status().isUnauthorized());
    mvc.perform(post("/api/auth/login").contentType("application/json").content(body))
        .andExpect(status().isTooManyRequests());
  }

  @Test
  void shareCanOnlyBeIssuedOnceAndByOriginalLogin() {
    UUID id = request(adminAccount, "CONTROL");
    service.decide(device, id, "accept");
    var another = account(admin, "ADMIN");
    assertThrows(Exception.class, () -> service.launch(another.actor(), id));
    service.launch(adminAccount.actor(), id);
    assertThrows(Exception.class, () -> service.launch(adminAccount.actor(), id));
    verify(engine, times(1)).create(anyString(), anyString(), anyBoolean());
  }

  @Test
  void logoutRevokesExistingShare() throws Exception {
    UUID id = request(adminAccount, "VIEW");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    mvc.perform(req("POST", "/api/auth/logout", adminAccount, null)).andExpect(status().isOk());
    verify(engine).remove("node//testnode", "test-share");
  }

  @Test
  void agentCannotDecideForAnotherDevice() throws Exception {
    UUID id = request(adminAccount, "VIEW");
    assertThrows(Exception.class, () -> service.decide(UUID.randomUUID(), id, "accept"));
    verify(engine, never()).create(anyString(), anyString(), anyBoolean());
  }

  @Test
  void invalidInputAndTicketHistory() throws Exception {
    mvc.perform(
            req(
                "POST",
                "/api/tickets",
                aliceAccount,
                Map.of("title", "", "description", "x", "category", "x", "priority", "CRITICAL")))
        .andExpect(status().isBadRequest());
    UUID id = ticket(aliceAccount);
    mvc.perform(
            req(
                "PUT",
                "/api/tickets/" + id,
                adminAccount,
                Map.of("status", "EM_ATENDIMENTO", "priority", "ALTA", "technicianId", tech)))
        .andExpect(status().isOk());
    var t = result(mvc.perform(req("GET", "/api/tickets/" + id, aliceAccount, null)));
    assertEquals(2, t.path("events").size());
    assertEquals("EM_ATENDIMENTO", t.path("status").asText());
  }

  @Test
  void realEngineObservationIsRequiredForActiveState() {
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL", null), "id");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    assertEquals("READY", service.get(adminAccount.actor(), id).get("status"));
    when(engine.observe(anyString(), eq(true), eq(false)))
        .thenReturn(
            new RemoteEngine.Observation("CONSENTED", null, null, System.currentTimeMillis()));
    service.sweep();
    assertEquals("AWAITING_FRAME", service.get(adminAccount.actor(), id).get("status"));
    assertNull(service.get(adminAccount.actor(), id).get("started_at"));
    when(engine.observe(anyString(), eq(true), eq(false)))
        .thenReturn(
            new RemoteEngine.Observation(
                "ACTIVE", null, System.currentTimeMillis(), System.currentTimeMillis()));
    service.sweep();
    assertEquals("ACTIVE", service.get(adminAccount.actor(), id).get("status"));
    assertNotNull(service.get(adminAccount.actor(), id).get("started_at"));
  }

  @Test
  void nativeRejectionAndLocalStopReachPanel() {
    for (String reason : List.of("REJECTED", "LOCAL_STOP", "CONNECTION_LOST", "LEASE_LOST")) {
      var id = Db.id(service.request(adminAccount.actor(), device, "VIEW", null), "id");
      service.decide(device, id, "accept");
      service.launch(adminAccount.actor(), id);
      when(engine.observe(anyString(), eq(true), eq(false)))
          .thenReturn(new RemoteEngine.Observation("ENDED", reason, null, null));
      service.sweep();
      var s = service.get(adminAccount.actor(), id);
      assertEquals("ENDED", s.get("status"));
      assertEquals(reason, s.get("result"));
      assertNull(s.get("started_at"));
    }
  }

  @Test
  void engineLossDoesNotKeepAnActiveBadge() {
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL", null), "id");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    when(engine.observe(anyString(), eq(true), eq(false))).thenThrow(new RuntimeException());
    doThrow(new RuntimeException()).when(engine).remove(anyString(), anyString());
    service.sweep();
    assertEquals("STOPPING", service.get(adminAccount.actor(), id).get("status"));
  }

  @Test
  void stopPreservesTransmissionThatOccurredBetweenPolls() {
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL", null), "id");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    long started = System.currentTimeMillis() - 500, ended = System.currentTimeMillis();
    when(engine.remove(anyString(), anyString()))
        .thenReturn(new RemoteEngine.Observation("ENDED", "SERVER_STOP", started, started, ended));
    service.stop(adminAccount.actor(), id);
    var s = service.get(adminAccount.actor(), id);
    assertEquals(Instant.ofEpochMilli(started), Db.instant(s.get("started_at")));
    assertEquals(Instant.ofEpochMilli(ended), Db.instant(s.get("ended_at")));
  }
}
