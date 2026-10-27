package br.com.uaitelecom.suporte;

import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Uses MeshCentral's existing control API. No encryption or desktop protocol implementation here.
 */
@Component
class MeshEngine implements RemoteEngine {
  final boolean enabled;
  final String url, user, password;
  final ObjectMapper json;
  final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  MeshEngine(
      @Value("${uai.mesh.enabled}") boolean enabled,
      @Value("${uai.mesh.url}") String url,
      @Value("${uai.mesh.user}") String user,
      @Value("${uai.mesh.password}") String password,
      ObjectMapper json) {
    this.enabled = enabled;
    this.url = url;
    this.user = user;
    this.password = password;
    this.json = json;
    if (enabled && (!url.startsWith("https://") || user.isBlank() || password.isBlank()))
      throw new IllegalStateException(
          "MeshCentral exige HTTPS e credenciais individuais de integração.");
  }

  public boolean enabled() {
    return enabled;
  }

  JsonNode command(Map<String, Object> data) {
    if (!enabled)
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Motor remoto desativado. Configure a prova Windows.");
    String correlation = UUID.randomUUID().toString();
    var payload = new HashMap<>(data);
    payload.put("responseid", correlation);
    var ready = new CompletableFuture<Void>();
    var response = new CompletableFuture<JsonNode>();
    WebSocket ws = null;
    try {
      ws =
          client
              .newWebSocketBuilder()
              .connectTimeout(Duration.ofSeconds(5))
              .header(
                  "x-meshauth",
                  Base64.getEncoder()
                          .encodeToString(user.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                      + ","
                      + Base64.getEncoder()
                          .encodeToString(
                              password.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
              .buildAsync(
                  URI.create(
                      url.replaceFirst("^https:", "wss:").replaceAll("/$", "") + "/control.ashx"),
                  new WebSocket.Listener() {
                    final StringBuilder buffer = new StringBuilder();

                    public void onOpen(WebSocket socket) {
                      socket.request(1);
                    }

                    public CompletionStage<?> onText(
                        WebSocket socket, CharSequence text, boolean last) {
                      buffer.append(text);
                      if (buffer.length() > 1048576) {
                        response.completeExceptionally(
                            new IllegalStateException("Resposta excessiva"));
                        socket.abort();
                        return null;
                      }
                      if (last) {
                        try {
                          var msg = json.readTree(buffer.toString());
                          if ("userinfo".equals(msg.path("action").asText())) ready.complete(null);
                          if (correlation.equals(msg.path("responseid").asText()))
                            response.complete(msg);
                          if ("close".equals(msg.path("action").asText()))
                            ready.completeExceptionally(
                                new IllegalStateException("Autenticação rejeitada"));
                        } catch (Exception e) {
                          response.completeExceptionally(e);
                        }
                        buffer.setLength(0);
                      }
                      socket.request(1);
                      return null;
                    }

                    public void onError(WebSocket socket, Throwable e) {
                      ready.completeExceptionally(e);
                      response.completeExceptionally(e);
                    }

                    public CompletionStage<?> onClose(WebSocket socket, int code, String reason) {
                      ready.completeExceptionally(new IllegalStateException("Conexão encerrada"));
                      response.completeExceptionally(
                          new IllegalStateException("Conexão encerrada"));
                      return null;
                    }
                  })
              .get(6, TimeUnit.SECONDS);
      ready.get(6, TimeUnit.SECONDS);
      ws.sendText(json.writeValueAsString(payload), true).get(3, TimeUnit.SECONDS);
      var result = response.get(10, TimeUnit.SECONDS);
      if (result.has("result") && !"OK".equalsIgnoreCase(result.path("result").asText()))
        throw new IllegalStateException("Operação recusada pelo motor");
      return result;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Motor remoto indisponível ou operação recusada.");
    } finally {
      if (ws != null) ws.abort();
    }
  }

  public Share create(String node, String guest, boolean viewOnly) {
    var capabilities = command(Map.of("action", "uaiSessionCapabilities"));
    if (capabilities.path("version").asInt() != 1
        || !capabilities.path("relayTelemetry").asBoolean()
        || !capabilities.path("oneConnection").asBoolean()
        || capabilities.path("leaseSeconds").asInt() != 12)
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Motor sem integração Uai compatível.");
    var result =
        command(
            Map.of(
                "action",
                "createDeviceShareLink",
                "nodeid",
                node,
                "guestname",
                guest,
                "p",
                2,
                "consent",
                72,
                "expire",
                1,
                "viewOnly",
                viewOnly));
    String id = result.path("publicid").asText(), link = result.path("url").asText();
    if (id.isBlank() || !link.startsWith(url.replaceAll("/$", "") + "/sharing?"))
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Resposta inesperada do motor. Confira URL e porta.");
    return new Share(id, link);
  }

  public Observation observe(String shareId, boolean renew, boolean stop) {
    var s =
        command(
                Map.of(
                    "action", "uaiSessionState", "publicid", shareId, "renew", renew, "stop", stop))
            .path("session");
    String state = s.path("state").asText();
    if (!Set.of(
            "UNKNOWN", "READY", "CONNECTING", "AWAITING_CONSENT", "CONSENTED", "ACTIVE", "ENDED")
        .contains(state))
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Estado inesperado do motor.");
    return new Observation(
        state,
        s.path("reason").isTextual() ? s.path("reason").asText() : null,
        s.path("startedAt").isNumber() ? s.path("startedAt").asLong() : null,
        s.path("consentAt").isNumber() ? s.path("consentAt").asLong() : null,
        s.path("endedAt").isNumber() ? s.path("endedAt").asLong() : null);
  }

  public Observation remove(String node, String shareId) {
    var observation = observe(shareId, false, true);
    if (!"ENDED".equals(observation.state()))
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Motor não confirmou interrupção.");

    var result =
        command(Map.of("action", "removeDeviceShare", "nodeid", node, "publicid", shareId));
    if (!result.path("removed").isObject()
        && !result.path("removed").asBoolean(false)
        && !"OK".equalsIgnoreCase(result.path("result").asText()))
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Encerramento não confirmado pelo motor.");
    return observation;
  }
}
