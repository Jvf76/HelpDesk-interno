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
  @Autowired MonitoringService monitoring;
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
            "fleet_metric", "device_change", "device_metric", "device_metric_hour", "device_event",
            "activation_token",
            "connection_attempt",
            "audit_event",
            "remote_session",
            "ticket_event",
            "ticket",
            "device_permission",
            "device",
            "user_session",
            "app_user",
            "login_attempt")) db.exec("DELETE FROM " + table);
    db.exec("UPDATE monitoring_config SET heartbeat_seconds=30,metrics_seconds=60,offline_seconds=100,cpu_limit=90,memory_limit=90,disk_free_limit=10,duration_seconds=300,silent_seconds=3600,detail_days=2,hourly_days=90,event_days=365,expected_app='',expected_agent='',rollup_until=NULL WHERE id=1");
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
    db.exec("INSERT INTO app_user(id,name,login,password_hash,role,active) VALUES (?,?,?,?,?,TRUE)", id, login, login, passwordHash, role);
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

  UUID request(Account a, String mode) {
    return (UUID) service.request(a.actor(), device, mode).get("id");
  }

  void grant(boolean control) {
    db.exec("INSERT INTO device_permission VALUES (?,?,?)", device, tech, control);
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
        "UPDATE device SET last_seen=? WHERE id=?", OffsetDateTime.now().minusSeconds(101), device);
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
  void realEngineObservationIsRequiredForActiveState() {
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL"), "id");
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
      var id = Db.id(service.request(adminAccount.actor(), device, "VIEW"), "id");
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
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL"), "id");
    service.decide(device, id, "accept");
    service.launch(adminAccount.actor(), id);
    when(engine.observe(anyString(), eq(true), eq(false))).thenThrow(new RuntimeException());
    doThrow(new RuntimeException()).when(engine).remove(anyString(), anyString());
    service.sweep();
    assertEquals("STOPPING", service.get(adminAccount.actor(), id).get("status"));
  }

  @Test
  void stopPreservesTransmissionThatOccurredBetweenPolls() {
    var id = Db.id(service.request(adminAccount.actor(), device, "CONTROL"), "id");
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
  @Test void retiredTicketRouteIsGone() throws Exception {
    mvc.perform(req("GET","/api/tickets",adminAccount,null)).andExpect(status().isNotFound());
  }
  @Test void localUserCanDowngradeControlToView() {
    var id=request(adminAccount,"CONTROL");service.decide(device,id,"accept-view");
    assertEquals("VIEW",service.get(adminAccount.actor(),id).get("mode"));
    service.launch(adminAccount.actor(),id);verify(engine).create(anyString(),anyString(),eq(true));
  }
  @Test void viewerBootstrapRequiresConsentAndOwner() {
    var id=request(adminAccount,"CONTROL");
    assertThrows(Exception.class,()->service.viewer(adminAccount.actor(),id,"127.0.0.1"));
    service.decide(device,id,"accept");
    assertThrows(Exception.class,()->service.viewer(techAccount.actor(),id,"127.0.0.1"));
    when(engine.viewer("test-share","127.0.0.1")).thenReturn(Map.of("authCookie","test-only","viewOnly",false,"expiresAt",1L));
    assertEquals("test-only",service.viewer(adminAccount.actor(),id,"127.0.0.1").get("authCookie"));
  }
  @Test void missingViewerBootstrapStopsIssuedShare() {
    var id=request(adminAccount,"VIEW");service.decide(device,id,"accept");
    when(engine.viewer(anyString(),anyString())).thenThrow(new IllegalStateException("Unavailable"));
    assertThrows(Exception.class,()->service.viewer(adminAccount.actor(),id,"127.0.0.1"));
    assertEquals("ENDED",service.get(adminAccount.actor(),id).get("status"));
  }

  @Test void clientOfflineRemovesPresenceAndStopsSession() throws Exception {
    var id=request(adminAccount,"CONTROL");
    mvc.perform(post("/api/agent/offline").header("Authorization","Bearer test-agent-identity").contentType("application/json").content("{}"))
      .andExpect(status().isOk());
    assertNull(db.one("SELECT last_seen FROM device WHERE id=?",device).get("last_seen"));
    assertEquals("LOCAL_STOP",service.get(adminAccount.actor(),id).get("result"));
    assertThrows(Exception.class,()->request(adminAccount,"VIEW"));
  }
  @Test void revokedAgentCannotMarkOffline() throws Exception {
    db.exec("UPDATE device SET revoked=TRUE WHERE id=?",device);
    mvc.perform(post("/api/agent/offline").header("Authorization","Bearer test-agent-identity").contentType("application/json").content("{}"))
      .andExpect(status().isUnauthorized());
  }

  @Test void ordinaryUserCanRequestButCannotLaunchWithoutConsent() throws Exception {
    var result = result(mvc.perform(req("POST", "/api/connections", bobAccount,
        Map.of("code",device.toString(),"mode","CONTROL"))).andExpect(status().isOk()));
    var id=UUID.fromString(result.get("id").asText());
    assertEquals("PENDING",result.get("status").asText());
    assertTrue(result.get("consent_only").asBoolean());
    assertEquals("bob",service.forDevice(device).getFirst().get("technician"));
    assertThrows(Exception.class,()->service.launch(bobAccount.actor(),id));
    verify(engine,never()).create(anyString(),anyString(),anyBoolean());
    service.decide(device,id,"accept-view");
    service.launch(bobAccount.actor(),id);
    verify(engine).create(anyString(),anyString(),eq(true));
  }
  @Test void assistedRejectionNeverCreatesTransport() {
    var id=Db.id(service.requestAssisted(bobAccount.actor(),device.toString(),"CONTROL","test-ip"),"id");
    service.decide(device,id,"reject");
    assertThrows(Exception.class,()->service.launch(bobAccount.actor(),id));
    verify(engine,never()).create(anyString(),anyString(),anyBoolean());
    assertEquals("REJECTED",service.get(bobAccount.actor(),id).get("result"));
  }
  @Test void assistedSessionStillRejectsRevokedUserAndLocalStop() {
    var id=Db.id(service.requestAssisted(bobAccount.actor(),device.toString(),"VIEW","test-ip"),"id");
    service.decide(device,id,"stop");
    assertEquals("LOCAL_STOP",service.get(bobAccount.actor(),id).get("result"));
    id=Db.id(service.requestAssisted(bobAccount.actor(),device.toString(),"VIEW","test-ip"),"id");
    db.exec("UPDATE app_user SET active=FALSE WHERE id=?",bob);service.sweep();
    assertEquals("ENDED",service.get(bobAccount.actor(),id).get("status"));
  }
  @Test void assistedSessionHistoryAndStopArePrivate() throws Exception {
    var id=Db.id(service.requestAssisted(bobAccount.actor(),device.toString(),"VIEW","test-ip"),"id");
    assertThrows(Exception.class,()->service.stop(aliceAccount.actor(),id));
    assertEquals(0,result(mvc.perform(req("GET","/api/connections",aliceAccount,null)).andExpect(status().isOk())).size());
    assertEquals(1,result(mvc.perform(req("GET","/api/connections",bobAccount,null)).andExpect(status().isOk())).size());
  }
  @Test void codeGuessingIsRateLimitedAndNeedsAuthentication() throws Exception {
    mvc.perform(post("/api/connections").contentType("application/json").content("{\"code\":\"x\",\"mode\":\"VIEW\"}")).andExpect(status().isUnauthorized());
    for(int i=0;i<5;i++) mvc.perform(req("POST","/api/connections",bobAccount,Map.of("code","invalid","mode","VIEW"))).andExpect(status().isNotFound());
    mvc.perform(req("POST","/api/connections",bobAccount,Map.of("code",device.toString(),"mode","VIEW"))).andExpect(status().isTooManyRequests());
    verify(engine,never()).create(anyString(),anyString(),anyBoolean());
  }

  @Test void enrollmentRetryRecoversLostResponseWithoutSecondDevice() throws Exception {
    db.exec("UPDATE device SET agent_hash=NULL,enrollment_hash=?,enrollment_expires=? WHERE id=?",Security.hash("one-use"),OffsetDateTime.now().plusMinutes(10),device);
    String credential=Security.token();
    String body=json.writeValueAsString(Map.of("code","one-use","os","Windows lab","credential",credential));
    var first=result(mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isOk()));
    var retry=result(mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isOk()));
    assertEquals(first,retry);assertEquals(device.toString(),first.get("deviceId").asText());
    assertEquals(1,db.list("SELECT id FROM device").size());
    assertNull(db.one("SELECT last_seen FROM device WHERE id=?",device).get("last_seen"));
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(json.writeValueAsString(Map.of("code","one-use","os","Other PC","credential",Security.token())))).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer "+credential)).andExpect(status().isOk());
  }
  @Test void recoveryPreservesCodeRevokesOldIdentityAndRequiresAdmin() throws Exception {
    mvc.perform(req("POST","/api/devices/"+device+"/recovery",bobAccount,Map.of())).andExpect(status().isForbidden());
    var recovery=result(mvc.perform(req("POST","/api/devices/"+device+"/recovery",adminAccount,Map.of())).andExpect(status().isOk()));
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer test-agent-identity")).andExpect(status().isUnauthorized());
    String credential=Security.token();
    var enrolled=result(mvc.perform(post("/api/agent/enroll").contentType("application/json").content(json.writeValueAsString(Map.of("code",recovery.get("code").asText(),"credential",credential,"os","Windows reinstall")))).andExpect(status().isOk()));
    assertEquals(device.toString(),enrolled.get("deviceId").asText());
    assertEquals(1,db.list("SELECT id FROM device").size());
    mvc.perform(req("POST","/api/devices/"+device+"/revoke",adminAccount,Map.of())).andExpect(status().isOk());
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer "+credential)).andExpect(status().isUnauthorized());
  }
  @Test void enrollmentReceiptExpiresAndDoesNotExposeSecrets() throws Exception {
    db.exec("UPDATE device SET agent_hash=NULL,enrollment_hash=?,enrollment_expires=? WHERE id=?",Security.hash("receipt"),OffsetDateTime.now().plusMinutes(10),device);
    String credential=Security.token();String body=json.writeValueAsString(Map.of("code","receipt","os","Windows lab","credential",credential));
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isOk());
    db.exec("UPDATE device SET enrollment_receipt_expires=? WHERE id=?",OffsetDateTime.now().minusSeconds(1),device);
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
    var publicRow=DeviceController.publicDevice(db.one("SELECT * FROM device WHERE id=?",device));
    assertFalse(publicRow.containsKey("agent_hash"));assertFalse(publicRow.containsKey("enrollment_receipt_hash"));
  }

  @Test void enrollmentAttemptsAreLimited() throws Exception {
    String body=json.writeValueAsString(Map.of("code","unknown-code","os","Windows lab","credential",Security.token()));
    for(int i=0;i<30;i++) mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/agent/enroll").contentType("application/json").content(body)).andExpect(status().isTooManyRequests());
  }

  @Test void bindingRequiresAgentProofAndRejectsDuplicateMeshIdentity() throws Exception {
    db.exec("UPDATE device SET mesh_node=NULL WHERE id=?",device);
    when(engine.enrollment(eq("begin"),eq(device))).thenReturn(Map.of("secret","a".repeat(64),"expires",System.currentTimeMillis()+120000,"msh","test"));
    mvc.perform(post("/api/agent/binding")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/agent/heartbeat").header("Authorization","Bearer test-agent-identity").contentType("application/json").content("{\"os\":\"Windows\"}")).andExpect(status().isForbidden());
    mvc.perform(post("/api/agent/binding").header("Authorization","Bearer test-agent-identity")).andExpect(status().isOk());
    when(engine.enrollment(eq("status"),eq(device))).thenReturn(new HashMap<>());
    mvc.perform(post("/api/agent/binding/confirm").header("Authorization","Bearer test-agent-identity")).andExpect(status().isOk()).andExpect(jsonPath("$.bound").value(false));
    when(engine.enrollment(eq("status"),eq(device))).thenReturn(Map.of("node","node//authenticated"));
    mvc.perform(post("/api/agent/binding/confirm").header("Authorization","Bearer test-agent-identity")).andExpect(status().isOk()).andExpect(jsonPath("$.bound").value(true));
    assertEquals("node//authenticated",db.one("SELECT mesh_node FROM device WHERE id=?",device).get("mesh_node"));
    mvc.perform(post("/api/agent/binding/confirm").header("Authorization","Bearer test-agent-identity")).andExpect(status().isOk());
    UUID other=UUID.randomUUID();
    db.exec("INSERT INTO device(id,name,location,department,agent_hash) VALUES (?,'Other','LAB','LAB',?)",other,Security.hash("other-token"));
    when(engine.enrollment(eq("status"),eq(other))).thenReturn(Map.of("node","node//authenticated"));
    mvc.perform(post("/api/agent/binding/confirm").header("Authorization","Bearer other-token")).andExpect(status().isForbidden());
  }
  @Test void localUninstallRevokesOnlyItsOwnCredential() throws Exception {
    mvc.perform(post("/api/agent/unregister")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/agent/unregister").header("Authorization","Bearer test-agent-identity")).andExpect(status().isOk());
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer test-agent-identity")).andExpect(status().isUnauthorized());
    assertEquals(Boolean.TRUE,db.one("SELECT revoked FROM device WHERE id=?",device).get("revoked"));
    assertEquals(1,db.list("SELECT id FROM device WHERE id=?",device).size(),"Public identity retained for recovery/audit");
  }
  @Test void metadataEditCannotReplaceMeshBinding() throws Exception {
    String body="{\"name\":\"PC editado\",\"location\":\"LAB\",\"department\":\"LAB\",\"meshNode\":null}";
    mvc.perform(put("/api/devices/"+device).cookie(adminAccount.cookie()).header("X-CSRF-Token",adminAccount.csrf()).contentType("application/json").content(body)).andExpect(status().isOk());
    assertEquals("node//testnode",db.one("SELECT mesh_node FROM device WHERE id=?",device).get("mesh_node"));
    mvc.perform(put("/api/devices/"+device).cookie(adminAccount.cookie()).header("X-CSRF-Token",adminAccount.csrf()).contentType("application/json").content(body.replace("null","\"node//other\""))).andExpect(status().isForbidden());
    mvc.perform(post("/api/devices").cookie(adminAccount.cookie()).header("X-CSRF-Token",adminAccount.csrf()).contentType("application/json").content(body.replace("null","\"node//other\""))).andExpect(status().isForbidden());
  }

  String registrationBody(UUID installation, String credential) throws Exception {
    return json.writeValueAsString(Map.of("installationId",installation,"credential",credential,"name","PC conta","os","Windows teste"));
  }
  MockHttpServletRequestBuilder registerRequest(Account account,String body) {
    return post("/api/devices/register").cookie(account.cookie()).header("X-CSRF-Token",account.csrf()).contentType("application/json").content(body);
  }
  @Test void accountRegistrationRequiresAuthenticationCsrfAndActiveUser() throws Exception {
    String body=registrationBody(UUID.randomUUID(),Security.token());
    mvc.perform(post("/api/devices/register").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/devices/register").cookie(aliceAccount.cookie()).contentType("application/json").content(body)).andExpect(status().isForbidden());
    db.exec("UPDATE app_user SET active=FALSE WHERE id=?",alice);
    mvc.perform(registerRequest(aliceAccount,body)).andExpect(status().isUnauthorized());
  }
  @Test void accountRegistrationCannotBypassActivation() throws Exception {
    mvc.perform(registerRequest(aliceAccount,registrationBody(UUID.randomUUID(),Security.token()))).andExpect(status().isGone());
    assertEquals(1,db.list("SELECT id FROM device").size());
  }
  @Test void retiredRegistrationCannotReplaceExistingIdentity() throws Exception {
    mvc.perform(registerRequest(adminAccount,registrationBody(UUID.randomUUID(),Security.token()))).andExpect(status().isGone());
    assertEquals(Security.hash("test-agent-identity"),db.one("SELECT agent_hash FROM device WHERE id=?",device).get("agent_hash"));
  }
  @Test void retiredRegistrationStillRejectsMalformedCredentials() throws Exception {
    mvc.perform(registerRequest(aliceAccount,registrationBody(UUID.randomUUID(),"invalid"))).andExpect(status().isBadRequest());
  }

  String activationToken() throws Exception {
    return result(mvc.perform(req("POST","/api/activation-tokens",adminAccount,Map.of("lifetimeSeconds",300))).andExpect(status().isOk())).get("token").asText();
  }
  MockHttpServletRequestBuilder activation(String token,UUID installation,String credential) throws Exception {
    return post("/api/agent/activate").contentType("application/json").content(json.writeValueAsString(Map.of("token",token,"installationId",installation,"credential",credential,"name","Windows A","os","Windows")));
  }
  @Test void activationIsSingleUseAndRecoversLostReply() throws Exception {
    String token=activationToken(),credential=Security.token();UUID installation=UUID.randomUUID();
    var first=result(mvc.perform(activation(token,installation,credential)).andExpect(status().isOk()));
    var second=result(mvc.perform(activation(token,installation,credential)).andExpect(status().isOk()));
    assertEquals(first,second);assertEquals(2,db.list("SELECT id FROM device").size());
    assertTrue(first.get("code").asText().matches("[A-Z0-9]{12}"));
    assertFalse(first.toString().contains(credential));assertFalse(first.toString().contains(token));
    mvc.perform(activation(token,UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/agent/heartbeat").header("Authorization","Bearer "+credential).contentType("application/json").content("{\"os\":\"Windows\"}")).andExpect(status().isForbidden());
    var d=db.one("SELECT * FROM device WHERE id=?",UUID.fromString(first.get("deviceId").asText()));
    assertNull(d.get("last_seen"));assertNull(d.get("mesh_node"));assertFalse(DeviceController.publicDevice(d).containsKey("agent_hash"));
  }
  @Test void activationInvalidExpiredRevokedAndRateLimited() throws Exception {
    mvc.perform(activation(Security.token(),UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized());
    String expired=activationToken();db.exec("UPDATE activation_token SET expires_at=? WHERE token_hash=?",OffsetDateTime.now().minusSeconds(1),Security.hash(expired));
    mvc.perform(activation(expired,UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Token expirado."));
    assertEquals(1,db.list("SELECT * FROM audit_event WHERE action='ACTIVATION_EXPIRED'").size());
    String revoked=activationToken();db.exec("UPDATE activation_token SET state='REVOKED' WHERE token_hash=?",Security.hash(revoked));
    mvc.perform(activation(revoked,UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Token revogado."));
    for(int n=0;n<7;n++)mvc.perform(activation(Security.token(),UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized());
    mvc.perform(activation(Security.token(),UUID.randomUUID(),Security.token())).andExpect(status().isTooManyRequests());
  }
  @Test void activationIssuanceRequiresAdminAndCsrf() throws Exception {
    mvc.perform(req("POST","/api/activation-tokens",aliceAccount,Map.of("lifetimeSeconds",300))).andExpect(status().isForbidden());
    mvc.perform(post("/api/activation-tokens").cookie(adminAccount.cookie()).contentType("application/json").content("{\"lifetimeSeconds\":300}")).andExpect(status().isForbidden());
    mvc.perform(req("POST","/api/activation-tokens",adminAccount,Map.of("lifetimeSeconds",86400))).andExpect(status().isBadRequest());
  }
  @Test void concurrentTokenConsumptionHasOnlyOneWinner() throws Exception {
    String token=activationToken();
    var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    var barrier=new java.util.concurrent.CyclicBarrier(2);
    try {
      java.util.concurrent.Callable<Integer> task=()->{var request=activation(token,UUID.randomUUID(),Security.token());barrier.await();return mvc.perform(request).andReturn().getResponse().getStatus();};
      var a=pool.submit(task);var b=pool.submit(task);
      var statuses=new ArrayList<>(List.of(a.get(),b.get()));Collections.sort(statuses);assertEquals(List.of(200,401),statuses);
      assertEquals(2,db.list("SELECT id FROM device").size());
    } finally {pool.shutdownNow();}
  }
  @Test void deviceControllerCannotImpersonateAnotherDeviceOrUser() throws Exception {
    mvc.perform(get("/api/desktop/identity").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",UUID.randomUUID())).andExpect(status().isForbidden());
    mvc.perform(get("/api/desktop/identity").cookie(adminAccount.cookie())).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/users").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",device)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/desktop/identity").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",device)).andExpect(status().isOk());
    db.exec("UPDATE device SET revoked=TRUE WHERE id=?",device);
    mvc.perform(get("/api/desktop/identity").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",device)).andExpect(status().isUnauthorized());
  }
  @Test void deviceRequestsRequireConsentAndStopOnRequesterRevocation() throws Exception {
    UUID target=UUID.randomUUID();db.exec("INSERT INTO device(id,name,location,department,public_code,agent_hash,mesh_node,last_seen) VALUES (?,'Target','LAB','LAB','ABCD12345678',?,'node//target',?)",target,Security.hash("target-agent"),OffsetDateTime.now());
    var request=post("/api/desktop/connections").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",device).contentType("application/json").content("{\"code\":\"ABCD 1234 5678\",\"mode\":\"CONTROL\",\"windowsUser\":\"LAB/test\"}");
    var session=result(mvc.perform(request).andExpect(status().isOk()));UUID id=UUID.fromString(session.get("id").asText());
    mvc.perform(post("/api/desktop/sessions/"+id+"/launch").header("Authorization","Bearer test-agent-identity").header("X-Uai-Device",device)).andExpect(status().isForbidden());
    verify(engine,never()).create(anyString(),anyString(),anyBoolean());
    assertEquals(device,Db.id(db.one("SELECT * FROM remote_session WHERE id=?",id),"requester_device_id"));
    service.decide(target,id,"accept-view");assertEquals("VIEW",db.one("SELECT mode FROM remote_session WHERE id=?",id).get("mode"));
    db.exec("UPDATE device SET revoked=TRUE WHERE id=?",device);service.sweep();
    assertNotNull(db.one("SELECT ended_at FROM remote_session WHERE id=?",id).get("ended_at"));
  }
  @Test void activatedCredentialRevocationCannotBeUndoneByReplayingToken() throws Exception {
    String token=activationToken(),credential=Security.token();UUID installation=UUID.randomUUID();
    var d=result(mvc.perform(activation(token,installation,credential)).andExpect(status().isOk()));
    mvc.perform(post("/api/agent/unregister").header("Authorization","Bearer "+credential)).andExpect(status().isOk());
    mvc.perform(activation(token,installation,credential)).andExpect(status().isUnauthorized());
    assertEquals(2,db.list("SELECT id FROM device").size());
  }

  @Test void recoveryTokenRotatesCredentialAndPreservesPublicCode() throws Exception {
    String token=activationToken(),old=Security.token();
    var original=result(mvc.perform(activation(token,UUID.randomUUID(),old)).andExpect(status().isOk()));
    UUID id=UUID.fromString(original.get("deviceId").asText());
    mvc.perform(post("/api/agent/unregister").header("Authorization","Bearer "+old)).andExpect(status().isOk());
    String recovery=result(mvc.perform(req("POST","/api/activation-tokens",adminAccount,Map.of("lifetimeSeconds",300,"recoverDeviceId",id))).andExpect(status().isOk())).get("token").asText();
    String next=Security.token();UUID installation=UUID.randomUUID();
    var body=Map.of("token",recovery,"installationId",installation,"credential",next,"name","Recovered Windows","os","Windows","recoverDeviceId",id);
    var recovered=result(mvc.perform(post("/api/agent/activate").contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()));
    assertEquals(original,recovered);assertEquals(2,db.list("SELECT id FROM device").size());
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer "+old)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/agent/identity").header("Authorization","Bearer "+next)).andExpect(status().isOk());
    var retry=result(mvc.perform(post("/api/agent/activate").contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()));assertEquals(recovered,retry);
  }
  @Test void administrativeTokenRevocationAndUnusedExpiryAreAudited() throws Exception {
    String token=activationToken();UUID id=Db.id(db.one("SELECT id FROM activation_token WHERE token_hash=?",Security.hash(token)),"id");
    mvc.perform(req("POST","/api/activation-tokens/"+id+"/revoke",adminAccount,Map.of())).andExpect(status().isOk());
    mvc.perform(activation(token,UUID.randomUUID(),Security.token())).andExpect(status().isUnauthorized());
    assertEquals(1,db.list("SELECT id FROM audit_event WHERE action='ACTIVATION_REVOKED'").size());
    assertFalse(db.one("SELECT * FROM activation_token WHERE id=?",id).toString().contains(token));
  }

  Map<String,Object> report(double cpu){return Map.of("machineName","WINDOWS-DETECTED","os","Windows 11","windowsUser","DOMAIN/user","appVersion","0.7-test","agentVersion","LAB-test","internalIp","10.0.0.10","uptimeSeconds",3600,"health","OK","metrics",Map.of("cpuPercent",cpu,"memoryTotal",16000000000L,"memoryAvailable",4000000000L,"disks",List.of(Map.of("volume","C:","totalBytes",100000000000L,"freeBytes",9000000000L))));}
  void sample(double cpu) throws Exception {db.exec("UPDATE device SET last_seen=?,metric_at=? WHERE id=?",OffsetDateTime.now().minusSeconds(10),OffsetDateTime.now().minusSeconds(61),device);mvc.perform(post("/api/agent/presence").header("Authorization","Bearer test-agent-identity").contentType("application/json").content(json.writeValueAsString(report(cpu)))).andExpect(status().isOk());}
  @Test void inventoryListsActivationWithoutExposingSecrets() throws Exception {
    var activated=result(mvc.perform(activation(activationToken(),UUID.randomUUID(),Security.token())).andExpect(status().isOk()));
    var page=result(mvc.perform(req("GET","/api/inventory",adminAccount,null)).andExpect(status().isOk()));
    assertEquals(2,page.get("total").asInt());assertFalse(page.toString().contains("agent_hash"));assertFalse(page.toString().contains("registration_hash"));
    assertTrue(page.toString().contains(activated.get("code").asText()));
  }
  @Test void metricsAndAdministrativeMetadataStaySeparate() throws Exception {
    var body=Map.of("friendlyName","Recepção","responsible","Colaborador A","city","Uberlândia","department","Atendimento","notes","LAB","reason","Transferência de setor");
    mvc.perform(req("PUT","/api/inventory/"+device,adminAccount,body)).andExpect(status().isOk());sample(70);
    var detail=result(mvc.perform(req("GET","/api/inventory/"+device,adminAccount,null)).andExpect(status().isOk()));
    assertEquals("Colaborador A",detail.at("/device/responsible").asText());assertEquals("DOMAIN/user",detail.at("/device/windows_user").asText());assertEquals("WINDOWS-DETECTED",detail.at("/device/name").asText());assertEquals(70,detail.at("/latest/0/cpu_pct").asInt());
    assertEquals(5,detail.get("changes").size());assertEquals(admin.toString(),detail.at("/changes/0/admin_id").asText());assertEquals(device.toString(),detail.at("/device/id").asText());
    assertTrue(db.exists("SELECT 1 FROM device_change WHERE device_id=? AND field_name='responsible' AND old_value='' AND new_value='Colaborador A'",device));
  }
  @Test void inventoryFiltersAndPaginationExecuteInDatabase() throws Exception {
    for(int i=0;i<30;i++)db.exec("INSERT INTO device(id,name,location,department,city,responsible,public_code,app_version) VALUES (?,?,'LAB','NOC','Cidade A','Pessoa',?,'version-test')",UUID.randomUUID(),"Computer "+i,"PUBLIC"+i);

    // Literal query filter below avoids URI-template encoding differences in the test client.
    var page=result(mvc.perform(get("/api/inventory").param("page","2").param("size","10").param("city","Cidade A").param("version","version-test").cookie(adminAccount.cookie())).andExpect(status().isOk()));
    assertEquals(30,page.get("total").asInt());assertEquals(10,page.get("items").size());assertEquals(2,page.get("page").asInt());
    mvc.perform(get("/api/inventory").param("size","10000").cookie(adminAccount.cookie())).andExpect(status().isBadRequest());
  }
  @Test void readOnlyPanelCannotEditActivateRevokeOrConnect() throws Exception {
    db.exec("UPDATE app_user SET panel_role='LEITURA' WHERE id=?",bob);
    mvc.perform(req("GET","/api/inventory",bobAccount,null)).andExpect(status().isOk());
    mvc.perform(req("GET","/api/users",bobAccount,null)).andExpect(status().isForbidden());
    mvc.perform(req("PUT","/api/inventory/"+device,bobAccount,Map.of("friendlyName","x","responsible","x","city","x","department","x","notes",""))).andExpect(status().isForbidden());
    mvc.perform(req("POST","/api/devices/"+device+"/revoke",bobAccount,Map.of())).andExpect(status().isForbidden());
    mvc.perform(req("POST","/api/activation-tokens",bobAccount,Map.of("lifetimeSeconds",60))).andExpect(status().isForbidden());
    mvc.perform(req("POST","/api/connections",bobAccount,Map.of("code",device.toString(),"mode","VIEW"))).andExpect(status().isForbidden());
    mvc.perform(req("POST","/api/sessions",bobAccount,Map.of("deviceId",device,"mode","CONTROL"))).andExpect(status().isForbidden());
  }
  @Test void operatorRequiresDevicePermissionAndRevocationStopsSession() throws Exception {
    db.exec("UPDATE app_user SET panel_role='OPERADOR' WHERE id=?",tech);
    mvc.perform(req("POST","/api/connections",techAccount,Map.of("code",device.toString(),"mode","CONTROL"))).andExpect(status().isForbidden());
    grant(true);var remote=result(mvc.perform(req("POST","/api/connections",techAccount,Map.of("code",device.toString(),"mode","CONTROL"))).andExpect(status().isOk()));
    db.exec("DELETE FROM device_permission WHERE user_id=?",tech);service.sweep();assertNotNull(db.one("SELECT ended_at FROM remote_session WHERE id=?",UUID.fromString(remote.get("id").asText())).get("ended_at"));
  }
  @Test void metricsRevocationAndPresenceRateLimit() throws Exception {
    sample(95);
    mvc.perform(post("/api/agent/presence").header("Authorization","Bearer test-agent-identity").contentType("application/json").content(json.writeValueAsString(report(95)))).andExpect(status().isTooManyRequests());
    mvc.perform(req("POST","/api/devices/"+device+"/revoke",adminAccount,Map.of())).andExpect(status().isOk());
    mvc.perform(post("/api/agent/presence").header("Authorization","Bearer test-agent-identity").contentType("application/json").content(json.writeValueAsString(report(95)))).andExpect(status().isUnauthorized());
    assertEquals(1,db.list("SELECT * FROM device_metric WHERE device_id=?",device).size());
  }
  @Test void resourceAlertsRequireDurationAndDisappearWhenOffline() throws Exception {
    sample(99);var before=result(mvc.perform(req("GET","/api/inventory/"+device,adminAccount,null)));assertFalse(before.at("/device/alerts").toString().contains("CPU_HIGH"));
    db.exec("UPDATE device SET cpu_high_since=? WHERE id=?",OffsetDateTime.now().minusMinutes(6),device);
    var after=result(mvc.perform(req("GET","/api/inventory/"+device,adminAccount,null)));assertTrue(after.at("/device/alerts").toString().contains("CPU_HIGH"));
    db.exec("UPDATE device SET last_seen=? WHERE id=?",OffsetDateTime.now().minusSeconds(101),device);
    var offline=result(mvc.perform(req("GET","/api/inventory/"+device,adminAccount,null)));assertEquals("OFFLINE",offline.at("/device/state").asText());assertFalse(offline.at("/device/alerts").toString().contains("CPU_HIGH"));
  }
  @Test void metricRetentionConsolidatesBeforeDeletingAndPreservesAudit() throws Exception {
    sample(75);db.exec("UPDATE device_metric SET observed_at=? WHERE device_id=?",OffsetDateTime.now().minusDays(3),device);db.audit(admin.toString(),"TEST_AUDIT",device);
    monitoring.retain();monitoring.retain();assertEquals(0,db.list("SELECT * FROM device_metric WHERE device_id=?",device).size());assertEquals(1,db.list("SELECT * FROM device_metric_hour WHERE device_id=?",device).size());assertTrue(db.exists("SELECT 1 FROM audit_event WHERE action='TEST_AUDIT'"));
    mvc.perform(get("/api/inventory/"+device+"/metrics").param("from",OffsetDateTime.now().minusDays(7).toString()).param("to",OffsetDateTime.now().toString()).cookie(adminAccount.cookie())).andExpect(status().isOk()).andExpect(jsonPath("$.resolution").value("hour"));
  }
  @Test void concurrentDeviceReportsStayIsolated() throws Exception {
    var ids=new ArrayList<UUID>();var pool=java.util.concurrent.Executors.newFixedThreadPool(6);
    try{var tasks=new ArrayList<java.util.concurrent.Callable<Integer>>();
      for(int i=0;i<18;i++){UUID id=UUID.randomUUID();ids.add(id);String token=Security.token();db.exec("INSERT INTO device(id,name,location,department,agent_hash,mesh_node) VALUES (?,'Concurrent','LAB','LAB',?,?)",id,Security.hash(token),"node//"+i);tasks.add(()->mvc.perform(post("/api/agent/presence").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsString(report(35)))).andReturn().getResponse().getStatus());}
      for(var f:pool.invokeAll(tasks))assertEquals(200,f.get());
      assertEquals(18,db.list("SELECT DISTINCT device_id FROM device_metric").size());
    }finally{pool.shutdownNow();}
  }

  @Test void inventorySeriesIncludeCurrentHourAndFleetSnapshots() throws Exception {
    sample(42);monitoring.fleet();
    var from=OffsetDateTime.now().minusDays(1).toString();var to=OffsetDateTime.now().toString();
    mvc.perform(get("/api/inventory/"+device+"/metrics").param("from",from).param("to",to).cookie(adminAccount.cookie())).andExpect(status().isOk()).andExpect(jsonPath("$.points[0].cpu_pct").value(42.0));
    mvc.perform(get("/api/monitoring/series").param("from",from).param("to",to).cookie(adminAccount.cookie())).andExpect(status().isOk());
    mvc.perform(req("GET","/api/monitoring/summary",adminAccount,null)).andExpect(status().isOk()).andExpect(jsonPath("$.totals.total").value(1));
  }
  @Test void newPanelRolesUseWebLoginAndCannotMutateMonitoringAsReader() throws Exception {
    mvc.perform(req("POST","/api/users",adminAccount,Map.of("name","Read only","login","read-only","password",PASSWORD,"role","LEITURA"))).andExpect(status().isOk());
    mvc.perform(post("/api/auth/login").contentType("application/json").content(json.writeValueAsString(Map.of("login","read-only","password",PASSWORD)))).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("LEITURA"));
    db.exec("UPDATE app_user SET panel_role='LEITURA' WHERE id=?",bob);
    mvc.perform(req("PUT","/api/monitoring/config",bobAccount,Map.ofEntries(Map.entry("heartbeatSeconds",30),Map.entry("metricsSeconds",60),Map.entry("offlineSeconds",100),Map.entry("cpuLimit",90),Map.entry("memoryLimit",90),Map.entry("diskFreeLimit",10),Map.entry("durationSeconds",300),Map.entry("silentSeconds",3600),Map.entry("detailDays",2),Map.entry("hourlyDays",90),Map.entry("eventDays",365),Map.entry("expectedApp",""),Map.entry("expectedAgent","")))).andExpect(status().isForbidden());
  }

  @Test void activationBindingPresenceAndInventoryUseTheSameDevice() throws Exception {
    String credential=Security.token();UUID installation=UUID.randomUUID();String token=activationToken();
    var activated=result(mvc.perform(activation(token,installation,credential)).andExpect(status().isOk()));UUID id=UUID.fromString(activated.get("deviceId").asText());
    mvc.perform(post("/api/agent/presence").header("Authorization","Bearer "+credential).contentType("application/json").content(json.writeValueAsString(report(20)))).andExpect(status().isForbidden());
    when(engine.enrollment(eq("status"),eq(id))).thenReturn(Map.of("node","node//activatedMonitor"));
    mvc.perform(post("/api/agent/binding/confirm").header("Authorization","Bearer "+credential)).andExpect(status().isOk());
    mvc.perform(post("/api/agent/presence").header("Authorization","Bearer "+credential).contentType("application/json").content(json.writeValueAsString(report(20)))).andExpect(status().isOk());
    var observed=result(mvc.perform(req("GET","/api/inventory/"+id,adminAccount,null)).andExpect(status().isOk()));
    assertEquals(activated.get("code").asText(),observed.at("/device/public_code").asText());assertEquals("ONLINE",observed.at("/device/state").asText());assertEquals(20,observed.at("/latest/0/cpu_pct").asInt());
    mvc.perform(activation(token,installation,credential)).andExpect(status().isOk());assertEquals(2,db.list("SELECT id FROM device").size());
  }
}
