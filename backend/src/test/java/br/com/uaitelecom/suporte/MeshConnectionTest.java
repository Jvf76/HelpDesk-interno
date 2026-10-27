package br.com.uaitelecom.suporte;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Optional real WSS/TLS check. Does not create a session or simulate a Windows agent. */
@EnabledIfEnvironmentVariable(named = "MESH_SMOKE_URL", matches = "https://.*")
class MeshConnectionTest {
  @Test
  void authenticatesOverVerifiedTlsAndReadsInventory() {
    var engine =
        new MeshEngine(
            true,
            System.getenv("MESH_SMOKE_URL"),
            System.getenv("MESH_SMOKE_USER"),
            System.getenv("MESH_SMOKE_PASSWORD"),
            new ObjectMapper());
    var reply = engine.command(Map.of("action", "nodes"));
    assertTrue(reply.has("nodes"));
  }

  @Test
  void invalidCredentialsAreRejected() {
    var engine =
        new MeshEngine(
            true,
            System.getenv("MESH_SMOKE_URL"),
            "nonexistent-test-user",
            Security.token(),
            new ObjectMapper());
    assertThrows(Exception.class, () -> engine.command(Map.of("action", "nodes")));
  }
}
