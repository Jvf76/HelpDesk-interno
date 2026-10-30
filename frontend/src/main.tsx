import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  setCsrf,
  date,
  type User,
  type Device,
  type RemoteSession,
} from "./api";
import { isDesktop, desktopViewer, desktopRequest } from "./desktop";
import "./style.css";
import { MonitoringPanel } from "./MonitoringPanel";
import { ActivationAdmin } from "./ActivationAdmin";
import { DeviceApp } from "./DeviceApp";
const states: Record<string, string> = {
  PENDING: "Solicitada • aguardando consentimento",
  CONSENTED: "Consentimento inicial recebido",
  ISSUING: "Preparando conexão",
  READY: "Aguardando autorização local do Uai Suporte",
  CONNECTING: "Conectando",
  AWAITING_CONSENT: "Aguardando consentimento local",
  AWAITING_FRAME: "Aguardando imagem",
  ACTIVE: "Ativa • imagem recebida pelo motor",
  STOPPING: "Encerrando • confirmação pendente",
  UNVERIFIED: "Sem confirmação do motor",
  ENDED: "Encerrada",
};
function state(s: RemoteSession) {
  if (s.ended_at) {
    if (s.result === "REJECTED") return "Recusada";
    if (s.result?.includes("EXPIRED")) return "Expirada";
    return "Encerrada";
  }
  return states[s.status] || s.status;
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [devices, setDevices] = useState<Device[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState("devices"),
    [selected, setSelected] = useState<Device | null>(null),
    [session, setSession] = useState<RemoteSession | null>(null),
    [history, setHistory] = useState<RemoteSession[]>([]),
    [modal, setModal] = useState(""),
    [code, setCode] = useState("");
  const [localDevice, setLocalDevice] = useState<{code?:string;state?:string;name?:string}>({});
  const [targetCode, setTargetCode] = useState("");
  const authenticated = useRef(false);
  useEffect(() => {
    if (!isDesktop) return;
    const update = () => void desktopRequest("/desktop/device", "GET", null, "")
      .then(async r => { if(r.ok) setLocalDevice(await r.json()); }).catch(() => {});
    update(); const timer = setInterval(update, 3000); return () => clearInterval(timer);
  }, []);
  const admin = user?.role === "ADMIN";
  function clear() {
    authenticated.current = false;
    setCsrf("");
    setUser(null);
    setDevices([]);
    setUsers([]);
    setSelected(null);
    setSession(null);
    setHistory([]);
    setModal("");
    setCode("");
    void desktopViewer("close");
  }
  useEffect(() => {
    api<User>("/auth/me", "GET", undefined, false)
      .then((u) => {
        authenticated.current = true;
        setUser(u);
        setCsrf(u.csrf);
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setInitial(false));
    const unauthorized = () => {
      if (authenticated.current) {
        clear();
        setError("Sessão expirada. Entre novamente.");
      }
    };
    window.addEventListener("unauthorized", unauthorized);
    return () => window.removeEventListener("unauthorized", unauthorized);
  }, []);
  async function refresh() {
    const [d, u] = await Promise.all([
      api<Device[]>("/devices"),
      admin ? api<User[]>("/users") : Promise.resolve([]),
    ]);
    setDevices(d);
    setUsers(u);
  }
  useEffect(() => {
    if (!user || ["ADMIN","TECNICO","OPERADOR","LEITURA"].includes(user.role)) return;
    void refresh().catch((e) => setError(e.message));
    const t = setInterval(
      () => void refresh().catch((e) => setError(e.message)),
      10000,
    );
    return () => clearInterval(t);
  }, [user?.id]);
  useEffect(() => {
    if (!session || session.ended_at) return;
    let stopped = false;
    const t = setInterval(() => {
      void api<RemoteSession>("/sessions/" + session.id)
        .then((s) => {
          if (stopped) return;
          setSession(s);
          if (s.ended_at || ["STOPPING", "UNVERIFIED"].includes(s.status))
            void desktopViewer("close");
        })
        .catch((e) => {
          if (stopped) return;
          setError(e.message);
          setSession((s) => (s ? { ...s, status: "UNVERIFIED" } : null));
          void desktopViewer("close");
        });
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [session?.id, session?.ended_at]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function fields(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  }
  async function request(d: Device, mode: string) {
    await action(async () => {
      setSession(
        await api<RemoteSession>("/connections", "POST", { code: d.id, mode }),
      );
      setSelected(d);
      setPage("remote");
      setModal("");
    });
  }
  const visible = devices.filter(
    (d) =>
      [d.id, d.name, d.department, d.location, d.owner_name]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || (filter === "online" ? d.online : !d.online)),
  );
  const alert = error && (
    <div className="alert" role="alert">
      {error}
      <button onClick={() => setError("")}>×</button>
    </div>
  );
  if (initial)
    return (
      <div className="login">
        <p>Carregando interface local…</p>
      </div>
    );
  if (!user)
    return (
      <div className="login">
        <div className="login-brand">
          <div className="mark">
            uai<span>•</span>
          </div>
          <h1>
            Acesso remoto.
            <br />
            Suporte próximo.
          </h1>
          <p>Uai Telecom • acesso remoto assistido</p>
          <small>Acesso assistido, autorizado e auditado</small>
        </div>
        <main>
          <form
            onSubmit={(e) => {
              const f = fields(e);
              void action(async () => {
                const u = await api<User>("/auth/login", "POST", f);
                setCsrf(u.csrf);
                authenticated.current = true;
                setUser(u);
              });
            }}
          >
            <h2>Uai Suporte</h2>
            <p>Entre com sua conta para solicitar conexões com consentimento.</p>
            {alert}
            <label>
              Login
              <input
                name="login"
                required
                autoComplete="username"
                maxLength={120}
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                maxLength={72}
              />
            </label>
            <button className="primary" disabled={busy}>
              Entrar
            </button>
            <small>
              {isDesktop
                ? "Interface incorporada • versão 0.5.3"
                : "Console de administração • acesso remoto pelo aplicativo Windows"}
            </small>
          </form>
        </main>
      </div>
    );
  if(["ADMIN","TECNICO","OPERADOR","LEITURA"].includes(user.role)) return <MonitoringPanel user={user} onLogout={clear}/>;
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="mark">uai•</span>
          <div>
            Suporte<small>Acesso remoto interno</small>
          </div>
        </div>
        <nav>
          <button onClick={() => setPage("devices")}>Seu código e conexão</button>
          {session && (
            <button onClick={() => setPage("remote")}>Sessão remota</button>
          )}
          {admin && (
            <button onClick={() => setPage("users")}>
              Usuários e permissões
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <p>
            {user.name} • {admin ? "Administrador" : "Usuário"}
          </p>
          <button
            title="Sair"
            onClick={() =>
              void action(async () => {
                await desktopViewer("close");
                await api("/auth/logout", "POST");
                clear();
                setError("");
              })
            }
          >
            Sair
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <h1>
            {page === "devices"
              ? "Seu código e conexão"
              : page === "remote"
                ? "Atendimento remoto"
                : "Administração"}
          </h1>
          <span>{devices.filter((d) => d.online).length} online</span>
        </header>
        <main>
          {alert}
          {admin && page === "devices" && <ActivationAdmin devices={devices} />}
          {page === "devices" && <section className="card connection-card" aria-label="Conexão assistida">
            <div className="connection-block">
            <h2>Seu código</h2>
            <input aria-label="Seu código" readOnly value={localDevice.code || "Cadastro deste computador pendente"} />
            <p>{localDevice.name} • {localDevice.state || (isDesktop ? "Verificando cadastro local…" : "Abra o aplicativo Windows para compartilhar este computador.")}</p>
            <p>O código identifica o computador. Ninguém recebe acesso sem sua autorização local.</p>
            {isDesktop && <button onClick={() => void desktopRequest("/desktop/receiving", "POST", null, "")}>Consentimento e encerrar acesso a este computador</button>}
            </div>
            <div className="connection-block">
            <h2>Conectar a outro computador</h2>
            <form onSubmit={e => { e.preventDefault(); void action(async () => {
              if(targetCode.trim().toLowerCase() === localDevice.code?.toLowerCase()) throw Error("Informe o código de outro computador.");
              setSession(await api<RemoteSession>("/connections", "POST", {code:targetCode.trim(),mode:"CONTROL"}));
              setSelected(null); setPage("remote");
            }); }}>
              <label>Código do computador<input aria-label="Código do computador" required maxLength={36} value={targetCode} onChange={e => setTargetCode(e.target.value)} placeholder="Cole a identificação compartilhada pela outra pessoa" /></label>
              <button className="primary" disabled={busy || !isDesktop}>Solicitar conexão</button>
            </form>
            <p>A outra pessoa verá seu nome autenticado e poderá recusar, permitir apenas visualização ou permitir controle.</p>
            <button onClick={() => void action(async () => {setHistory(await api<RemoteSession[]>("/connections"));setModal("history");})}>Meu histórico de conexões</button>
            </div>
          </section>}
          {page === "devices" && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Pesquisar computador"
                  placeholder="Nome, identificação, setor ou responsável"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Conexão"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <button onClick={() => void action(refresh)}>Atualizar</button>
                {admin && (
                  <button
                    className="primary"
                    onClick={() => {
                      setCode("");
                      setSelected(null);
                      setModal("device");
                    }}
                  >
                    Cadastrar computador
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Computador / identificação</th>
                      <th>Setor / local</th>
                      <th>Responsável</th>
                      <th>Conexão</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <b>{d.name}</b>
                          <small>{d.id}</small>
                        </td>
                        <td>
                          {d.department}
                          <small>{d.location}</small>
                        </td>
                        <td>{d.owner_name || "—"}</td>
                        <td>
                          {d.revoked
                            ? "Revogado"
                            : d.online
                              ? "Online"
                              : "Offline"}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSelected(d);
                              setHistory([]);
                              setCode("");
                              setModal("access");
                            }}
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <p className="empty">Nenhum computador encontrado.</p>
                )}
              </div>
            </>
          )}
          {page === "remote" && session && (
            <>
              <section className="info-card">
                <h2>{selected?.name || session.device_id}</h2>
                <p>Identificação: {session.device_id}</p>
                <h3>{state(session)}</h3>
                <p>
                  {session.mode === "VIEW"
                    ? "Somente visualização"
                    : "Visualização e controle"}{" "}
                  • Limite: {date(session.expires_at)}
                </p>
                <p>
                  Início: {date(session.started_at)} • Término:{" "}
                  {date(session.ended_at)}
                </p>
                {session.result && <p>Motivo: {session.result}</p>}
                {session.status === "CONSENTED" && !session.ended_at && (
                  <button
                    className="primary"
                    disabled={busy || !isDesktop}
                    onClick={() =>
                      void action(async () => {
                        await api(
                          "/sessions/" + session.id + "/launch",
                          "POST",
                        );
                        setSession(await api("/sessions/" + session.id));
                      })
                    }
                  >
                    Abrir visualizador interno
                  </button>
                )}
                <button
                  className="danger"
                  disabled={busy || !!session.ended_at}
                  onClick={() =>
                    void action(async () => {
                      await desktopViewer("close");
                      setSession(
                        await api("/sessions/" + session.id + "/stop", "POST"),
                      );
                    })
                  }
                >
                  Encerrar sessão
                </button>
              </section>
              <p>
                O visualizador aparece na aba nativa Atendimento remoto. O
                estado Ativa exige dados reais do motor, não apenas conexão. Ao
                perder confirmação, a imagem é fechada.
              </p>
            </>
          )}
          {page === "users" && admin && (
            <>
              <button onClick={() => setModal("user")}>Novo usuário</button>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Login</th>
                      <th>Perfil</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.login}</td>
                        <td>{u.role}</td>
                        <td>{u.active ? "Ativo" : "Inativo"}</td>
                        <td>
                          {u.id !== user.id && (
                            <button
                              onClick={() =>
                                void action(async () => {
                                  await api("/users/" + u.id, "PUT", {
                                    role: u.role,
                                    active: !u.active,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              {u.active ? "Desativar" : "Ativar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
      {modal && (
        <div className="overlay">
          <section className="modal">
            <button className="close" onClick={() => setModal("")}>
              ×
            </button>
            {modal === "access" && selected && (
              <>
                <h2>{selected.name}</h2>
                <p>{selected.id}</p>
                <p>
                  {selected.online ? "Online" : "Offline"} • {selected.os}
                </p>
                <div className="actions">
                  <button
                    disabled={busy || !selected.online || !isDesktop}
                    onClick={() => void request(selected, "VIEW")}
                  >
                    Solicitar visualização
                  </button>
                  <button
                    className="primary"
                    disabled={busy || !selected.online || !isDesktop}
                    onClick={() => void request(selected, "CONTROL")}
                  >
                    Solicitar controle
                  </button>
                  <button
                    onClick={() =>
                      void action(async () =>
                        setHistory(
                          (
                            await api<{ sessions: RemoteSession[] }>(
                              "/devices/" + selected.id + "/history",
                            )
                          ).sessions,
                        ),
                      )
                    }
                  >
                    Histórico de acessos
                  </button>
                </div>
                {!isDesktop && (
                  <p>Inicie sessões pelo aplicativo Uai Suporte Windows.</p>
                )}
                {admin && (
                  <>
                    <hr />
                    <button onClick={() => setModal("device")}>
                      Editar cadastro
                    </button>
                    <button
                      onClick={() =>
                        void action(async () => {
                          const r = await api<{ code: string }>(
                            "/devices/" + selected.id + "/enrollment",
                            "POST",
                          );
                          setCode(r.code);
                        })
                      }
                    >
                      Código temporário de cadastro
                    </button>
                    <button onClick={() => {
                      if (!window.confirm("Recuperar o mesmo código público? A credencial anterior será revogada e as sessões encerradas.")) return;
                      void action(async () => {
                        const r = await api<{code:string}>("/devices/" + selected.id + "/recovery", "POST");
                        setCode(r.code); await refresh();
                      });
                    }}>Recuperar cadastro para reinstalação</button>
                    <button
                      className="danger"
                      onClick={() =>
                        void action(async () => {
                          await api(
                            "/devices/" + selected.id + "/revoke",
                            "POST",
                          );
                          setModal("");
                          await refresh();
                        })
                      }
                    >
                      Revogar dispositivo
                    </button>
                    {code && (
                      <p>
                        <code>{code}</code> • Uso único, válido por 10 minutos;
                        somente TI.
                      </p>
                    )}

                  </>
                )}
                {history.map((s) => (
                  <p key={s.id}>
                    {s.requester_name || s.technician_name} • {s.mode} • {state(s)}
                    <small>
                      Solicitado: {date(s.requested_at)} • Início: {date(s.started_at)} → Fim: {date(s.ended_at)} • {s.result}
                    </small>
                  </p>
                ))}
              </>
            )}
            {modal === "device" && admin && (
              <>
                <h2>
                  {selected ? "Editar computador" : "Cadastrar computador"}
                </h2>
                <form
                  onSubmit={(e) => {
                    const f = fields(e);
                    void action(async () => {
                      const body = {
                        ...f,
                        ownerId: f.ownerId || null,
                        meshNode: null,
                      };
                      if (selected) {
                        await api("/devices/" + selected.id, "PUT", body);
                        setModal("");
                      } else {
                        const r = await api<{ code: string }>(
                          "/devices",
                          "POST",
                          body,
                        );
                        setCode(r.code);
                      }
                      await refresh();
                    });
                  }}
                >
                  {[
                    ["name", "Nome"],
                    ["department", "Setor"],
                    ["location", "Localidade"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        name={key}
                        required
                        maxLength={120}
                        defaultValue={
                          selected?.[key as "name" | "department" | "location"]
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Responsável
                    <select
                      name="ownerId"
                      defaultValue={selected?.owner_id || ""}
                    >
                      <option value="">Não informado</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>O instalador confirma automaticamente a identidade do MeshAgent.</p>
                  <button disabled={busy || (!selected && !!code)}>
                    Salvar
                  </button>
                </form>
                {code && (
                  <p>
                    Código de uso único para a TI: <code>{code}</code> (10
                    minutos)
                  </p>
                )}
              </>
            )}
            {modal === "user" && admin && (
              <>
                <h2>Novo usuário</h2>
                <form
                  onSubmit={(e) => {
                    const f = fields(e);
                    void action(async () => {
                      await api("/users", "POST", f);
                      setModal("");
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Nome
                    <input name="name" required maxLength={120} />
                  </label>
                  <label>
                    Login
                    <input name="login" required maxLength={120} />
                  </label>
                  <label>
                    Senha inicial
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={14}
                      maxLength={72}
                    />
                  </label>
                  <select name="role">
                    <option value="SOLICITANTE">Usuário</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  <button disabled={busy}>Criar</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isDesktop ? <DeviceApp /> : <App />}
  </React.StrictMode>,
);
