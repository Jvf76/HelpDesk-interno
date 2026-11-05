package br.com.uaitelecom.suporte;

import java.util.*;

/** Explicit attempt lifecycle, independent of legacy transport status. Terminal is absorbing. */
final class SessionLifecycle {
  static final Set<String> TERMINAL=Set.of("CONSENT_REJECTED","TERMINATED","EXPIRED","REVOKED","FAILED");
  static final Map<String,Set<String>> EDGES=Map.ofEntries(
    Map.entry("REQUESTED",Set.of("TARGET_NOTIFIED")),
    Map.entry("TARGET_NOTIFIED",Set.of("CONSENT_PENDING")),
    Map.entry("CONSENT_PENDING",Set.of("CONSENT_ACCEPTED_VIEW","CONSENT_ACCEPTED_CONTROL","CONSENT_REJECTED")),
    Map.entry("CONSENT_ACCEPTED_VIEW",Set.of("ENGINE_AUTHORIZING")),
    Map.entry("CONSENT_ACCEPTED_CONTROL",Set.of("ENGINE_AUTHORIZING")),
    Map.entry("ENGINE_AUTHORIZING",Set.of("TRANSPORT_CONNECTING")),
    Map.entry("TRANSPORT_CONNECTING",Set.of("ENGINE_CONSENT_PENDING","AWAITING_FIRST_FRAME")),
    Map.entry("ENGINE_CONSENT_PENDING",Set.of("AWAITING_FIRST_FRAME")),
    Map.entry("AWAITING_FIRST_FRAME",Set.of("FIRST_FRAME_RECEIVED")),
    Map.entry("FIRST_FRAME_RECEIVED",Set.of("VIEWING","CONTROLLING")),
    Map.entry("VIEWING",Set.of()),Map.entry("CONTROLLING",Set.of()),
    Map.entry("STOP_REQUESTED",Set.of("ENGINE_STOPPING")),
    Map.entry("ENGINE_STOPPING",TERMINAL));
  static boolean allows(String from,String to) {
    if(from.equals(to))return true; // Duplicate event: no transition and no deadline extension.
    if(TERMINAL.contains(from))return false;
    if(Set.of("FAILED","EXPIRED","REVOKED","STOP_REQUESTED").contains(to))return true;
    return EDGES.getOrDefault(from,Set.of()).contains(to);
  }
  static int timeout(String phase) {
    return switch(phase) {
      case "REQUESTED","TARGET_NOTIFIED","CONSENT_PENDING" -> 60;
      case "CONSENT_ACCEPTED_VIEW","CONSENT_ACCEPTED_CONTROL" -> 15;
      case "ENGINE_AUTHORIZING" -> 20;
      case "TRANSPORT_CONNECTING" -> 15;
      case "ENGINE_CONSENT_PENDING" -> 35;
      case "AWAITING_FIRST_FRAME","FIRST_FRAME_RECEIVED" -> 15;
      case "STOP_REQUESTED","ENGINE_STOPPING" -> 10;
      default -> 0;
    };
  }
  static String message(String phase) {
    return switch(phase) {
      case "REQUESTED" -> "Solicitação criada.";
      case "TARGET_NOTIFIED","CONSENT_PENDING" -> "Aguardando autorização no computador acessado.";
      case "CONSENT_ACCEPTED_VIEW","CONSENT_ACCEPTED_CONTROL" -> "Autorização local recebida; transmissão ainda não iniciada.";
      case "ENGINE_AUTHORIZING" -> "Emitindo autorização temporária do motor.";
      case "TRANSPORT_CONNECTING" -> "Estabelecendo transporte remoto.";
      case "ENGINE_CONSENT_PENDING" -> "Aguardando confirmação no computador acessado";
      case "AWAITING_FIRST_FRAME" -> "Acesso autorizado — aguardando imagem";
      case "FIRST_FRAME_RECEIVED" -> "Primeira imagem confirmada pelo controlador.";
      case "VIEWING" -> "Visualização ativa";
      case "CONTROLLING" -> "Controle ativo";
      case "STOP_REQUESTED","ENGINE_STOPPING" -> "Bloqueando acesso e confirmando encerramento.";
      case "CONSENT_REJECTED" -> "Solicitação recusada no computador acessado.";
      case "EXPIRED" -> "O prazo da tentativa terminou. Solicite uma nova conexão.";
      case "REVOKED" -> "Autorização revogada. Acesso encerrado.";
      case "FAILED" -> "Não foi possível concluir a etapa. Tentativa bloqueada; consulte o diagnóstico.";
      default -> "Sessão encerrada. Não pode ser retomada.";
    };
  }
}
