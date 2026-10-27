package br.com.uaitelecom.suporte;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Contract checks against response shapes inspected in MeshCentral 1.3.1; not a Windows test. */
class MeshContractTest {
  final ObjectMapper json = new ObjectMapper();

  class Stub extends MeshEngine {
    String response;
    Map<String, Object> request;

    Stub(String response) {
      super(true, "https://mesh.internal:4433", "test-user", "test-only", MeshContractTest.this.json);
      this.response = response;
    }

    @Override
    com.fasterxml.jackson.databind.JsonNode command(Map<String, Object> data) {
      request = data;
      try {
        return json.readTree(response);
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }
  }

  @Test
  void createLimitsProtocolConsentLifetimeAndViewMode() {
    var engine =
        new Stub(
            "{\"publicid\":\"id\",\"url\":\"https://mesh.internal:4433/sharing?c=temporary\",\"result\":\"OK\"}");
    engine.create("node//test", "Técnico", true);
    assertEquals(2, engine.request.get("p"));
    assertEquals(72, engine.request.get("consent"));
    assertEquals(1, engine.request.get("expire"));
    assertEquals(true, engine.request.get("viewOnly"));
  }

  @Test
  void removedShareObjectIsAConfirmation() {
    var engine = new Stub("{\"removed\":{\"publicid\":\"id\"}}");
    assertDoesNotThrow(() -> engine.remove("node//test", "id"));
  }

  @Test
  void missingRemovalConfirmationFailsClosed() {
    var engine = new Stub("{\"removed\":null}");
    assertThrows(Exception.class, () -> engine.remove("node//test", "id"));
  }

  @Test
  void unrelatedRemoteOriginIsRejected() {
    var engine =
        new Stub("{\"publicid\":\"id\",\"url\":\"https://untrusted.invalid/sharing?c=x\"}");
    assertThrows(Exception.class, () -> engine.create("node//test", "Técnico", false));
  }
}
