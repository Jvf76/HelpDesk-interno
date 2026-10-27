export type User = {
  id: string;
  name: string;
  role: "ADMIN" | "TECNICO" | "SOLICITANTE";
  csrf: string;
  login?: string;
  active?: boolean;
};
export type Device = {
  id: string;
  name: string;
  os: string;
  location: string;
  department: string;
  owner_id: string | null;
  mesh_node: string | null;
  online: boolean;
  revoked: boolean;
  last_seen: string | null;
};
export type Ticket = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  device_id: string | null;
  requester_name?: string;
  technician_id: string | null;
  created_at: string;
  events?: {
    id: string;
    body: string;
    kind: string;
    author: string;
    created_at: string;
  }[];
  sessions?: RemoteSession[];
};
export type RemoteSession = {
  id: string;
  device_id: string;
  mode: string;
  status: string;
  expires_at: string;
  requested_at: string;
  ended_at: string | null;
  result: string | null;
};
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const error = await r
      .json()
      .catch(() => ({ message: "Não foi possível concluir a operação." }));
    if (r.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("unauthorized"));
    throw new Error(error.message ?? "Operação recusada.");
  }
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? (undefined as T)
    : await r.text().then((text) => (text ? JSON.parse(text) : undefined));
}
export const labels: Record<string, string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
  SOLICITANTE: "Solicitante",
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em atendimento",
  AGUARDANDO: "Aguardando",
  RESOLVIDO: "Resolvido",
  BAIXA: "Baixa",
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
  PENDING: "Aguardando consentimento local",
  CONSENTED: "Consentimento recebido",
  ISSUING: "Preparando acesso",
  READY: "Link emitido • confirme a conexão na janela remota",
  STOPPING: "Encerramento pendente no motor",
  ENDED: "Solicitação encerrada",
  VIEW: "Visualização",
  CONTROL: "Visualização e controle",
};
export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR") : "Sem registro";
