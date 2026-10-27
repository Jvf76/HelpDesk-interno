package br.com.uaitelecom.suporte;

interface RemoteEngine {
  record Share(String id, String url) {}

  boolean enabled();

  Share create(String node, String guest, boolean viewOnly);

  void remove(String node, String shareId);
}
