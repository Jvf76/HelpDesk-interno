import { isDesktop, desktopRequest } from "./desktop";
export type User = {
  id: string;
  name: string;
  role: "ADMIN" | "TECNICO" | "SOLICITANTE" | "OPERADOR" | "LEITURA";
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
  owner_name?: string;
  mesh_node: string | null;
  online: boolean;
  revoked: boolean;
  last_seen: string | null;
};
export type RemoteSession = {
  id: string;
  device_id: string;
  mode: string;
  status: string;
  expires_at: string;
  requested_at: string;
  ended_at: string | null;
  started_at: string | null;
  engine_seen_at: string | null;
  engine_consent_at: string | null;
  result: string | null;
  technician_name?: string;
  requester_name?: string;
};
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  notifyUnauthorized = true,
): Promise<T> {
  const r = isDesktop
    ? await desktopRequest(path, method, body, csrf)
    : await fetch("/api" + path, {
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
    if (!isDesktop && notifyUnauthorized && r.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("unauthorized"));
    throw Object.assign(new Error(error.message ?? "Operação recusada."), {
      status: r.status,
    });
  }
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? (undefined as T)
    : await r.text().then((text) => (text ? JSON.parse(text) : undefined));
}
export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR") : "Sem registro";
