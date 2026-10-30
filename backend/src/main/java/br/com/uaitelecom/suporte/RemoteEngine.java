package br.com.uaitelecom.suporte;

interface RemoteEngine {
  record Share(String id, String url) {}

  record Observation(String state, String reason, Long startedAt, Long consentAt, Long endedAt) {
    Observation(String state, String reason, Long startedAt, Long consentAt) {
      this(state, reason, startedAt, consentAt, null);
    }
  }

  Observation observe(String shareId, boolean renew, boolean stop);

  java.util.Map<String,Object> viewer(String shareId, String clientIp);

  boolean enabled();

  Share create(String node, String guest, boolean viewOnly);

  Observation remove(String node, String shareId);
}
