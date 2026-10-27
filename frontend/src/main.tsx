import { isDesktop } from "./desktop";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Monitor,
  Ticket as TicketIcon,
  Users,
  LogOut,
  Search,
  Plus,
  ArrowLeft,
  ShieldCheck,
  Radio,
  RefreshCw,
} from "lucide-react";
import {
  api,
  setCsrf,
  labels,
  date,
  type User,
  type Device,
  type Ticket,
  type RemoteSession,
} from "./api";
import "./style.css";
function App() {
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [page, setPage] = useState("dashboard"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [devices, setDevices] = useState<Device[]>([]),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [location, setLocation] = useState(""),
    [tech, setTech] = useState(""),
    [detail, setDetail] = useState<Ticket | null>(null),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState<Device | null>(null),
    [code, setCode] = useState(""),
    [session, setSession] = useState<RemoteSession | null>(null),
    [history, setHistory] = useState<{
      tickets: Ticket[];
      sessions: RemoteSession[];
    } | null>(null),
    [busy, setBusy] = useState(false);
  const authenticated = useRef(false);
  const staff = user?.role !== "SOLICITANTE",
    admin = user?.role === "ADMIN";
  useEffect(() => {
    api<User>("/auth/me", "GET", undefined, false)
      .then((u) => {
        authenticated.current = true;
        setUser(u);
        setCsrf(u.csrf);
      })
      .catch((e) => { if (e.status !== 401) setError(e.message || "Servidor indisponível. Confira a conexão."); })
      .finally(() => setInitial(false));
    const handler = () => {
      if (!authenticated.current) return;
      authenticated.current = false;
      setCsrf("");
      setUser(null);
      setSession(null);
      setDevices([]);
      setTickets([]);
      setUsers([]);
      setDetail(null);
      setHistory(null);
      setSelected(null);
      setCode("");
      setModal("");
      setPage("dashboard");
      setError("Sessão expirada. Entre novamente.");
    };
    window.addEventListener("unauthorized", handler);
    return () => window.removeEventListener("unauthorized", handler);
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [d, t, u] = await Promise.all([
        api<Device[]>("/devices"),
        api<Ticket[]>("/tickets"),
        user.role === "SOLICITANTE"
          ? Promise.resolve([])
          : api<User[]>("/users"),
      ]);
      setDevices(d);
      setTickets(t);
      setUsers(u);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!session || session.ended_at) return;
    const t = setInterval(() => {
      api<RemoteSession>("/sessions/" + session.id)
        .then(setSession)
        .catch((e) => {
          setError(e.message);
          setSession(current => current && !current.ended_at ? {...current, status: "UNVERIFIED"} : current);
        });
    }, 2500);
    return () => clearInterval(t);
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
  const form = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  function nav(p: string) {
    setPage(p);
    setDetail(null);
    setQuery("");
    setHistory(null);
  }
  async function openTicket(id: string) {
    setDetail(await api<Ticket>("/tickets/" + id));
    setPage("tickets");
  }
  async function requestRemote(d: Device, mode: string) {
    await action(async () => {
      setSession(
        await api<RemoteSession>("/sessions", "POST", {
          deviceId: d.id,
          mode,
          ticketId: detail?.device_id === d.id ? detail.id : null,
        }),
      );
      setSelected(d);
      setModal("");
      setPage("remote");
    });
  }
  const visibleDevices = devices.filter(
    (d) =>
      (d.name + " " + d.department + " " + d.location)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || (status === "online" ? d.online : !d.online)) &&
      (!location || d.location === location),
  );
  const visibleTickets = tickets.filter(
    (t) =>
      (t.title + " " + t.category)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      (!tech || t.technician_id === tech) &&
      (!location ||
        devices.find((d) => d.id === t.device_id)?.location === location),
  );
  const errorBox = error && (
    <div className="alert" role="alert">
      {error}
      <button onClick={() => setError("")} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  );
  if (initial)
    return (
      <div className="login">
        <p>Carregando Uai Suporte…</p>
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
            Suporte próximo.
            <br />
            Trabalho conectado.
          </h1>
          <p>
            Central de atendimento interno
            <br />
            Uai Telecom · TI / NOC
          </p>
          <small>
            <ShieldCheck size={16} /> Acesso restrito à equipe e colaboradores
          </small>
        </div>
        <main>
          <form
            onSubmit={(e) => {
              const f = form(e);
              void action(async () => {
                const u = await api<User>("/auth/login", "POST", f);
                setCsrf(u.csrf);
                authenticated.current = true;
                setUser(u);
              });
            }}
          >
            <span className="eyebrow">UAI SUPORTE</span>
            <h2>Bem-vindo de volta</h2>
            <p>Entre para acompanhar seus atendimentos.</p>
            {errorBox}
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
                type="password"
                name="password"
                required
                autoComplete="current-password"
                maxLength={72}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Entrando…" : "Entrar no painel"}
            </button>
            <small>{isDesktop ? "Aplicativo Técnico • interface incorporada • versão 0.2.0" : "Precisa de acesso? Procure o administrador de TI."}</small>
          </form>
        </main>
      </div>
    );
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="mark">
            uai<span>•</span>
          </span>
          <div>
            Suporte<small>UAI TELECOM</small>
          </div>
        </div>
        <small className="nav-caption">CENTRAL DE ATENDIMENTO</small>
        <nav>
          {[
            ["dashboard", "Visão geral", LayoutDashboard],
            ["devices", "Computadores", Monitor],
            ["tickets", "Chamados", TicketIcon],
            ...(admin ? [["users", "Administração", Users]] : []),
          ].map(([id, name, Icon]) => {
            const I = Icon as typeof Monitor;
            return (
              <button
                key={id as string}
                className={page === id ? "active" : ""}
                onClick={() => {
                  setStatus("");
                  nav(id as string);
                }}
              >
                <I size={19} />
                {name as string}
              </button>
            );
          })}
          {session && (
            <button
              className={page === "remote" ? "active" : ""}
              onClick={() => setPage("remote")}
            >
              <Radio size={19} />
              Atendimento remoto
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="pilot">PILOTO · REDE LOCAL / VPN</span>
          <p>
            Atendimento com consentimento.
            <br />
            Você mantém o controle.
          </p>
        </div>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            {user.name}
            <small>{labels[user.role]}</small>
          </div>
          <button
            title="Sair"
            onClick={() =>
              void action(async () => {
                await api("/auth/logout", "POST");
                authenticated.current = false;
                setCsrf("");
                setError("");
                window.location.reload();
                setUser(null);
                setSession(null);
                setDevices([]);
                setTickets([]);
              })
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            Workspace <b>/</b>{" "}
            {
              (
                {
                  dashboard: "Visão geral",
                  devices: "Computadores",
                  tickets: "Chamados",
                  users: "Administração",
                  remote: "Atendimento remoto",
                } as Record<string, string>
              )[page]
            }
          </span>
          <div>
            <span className="organization">TI / NOC</span>
            <button
              title="Atualizar"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>
        <main>
          {errorBox}
          {page === "dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SEU DIA NO SUPORTE</span>
                  <h1>Visão geral</h1>
                  <p>Acompanhe os computadores e o que precisa de atenção.</p>
                </div>
                <button className="primary" onClick={() => setModal("ticket")}>
                  <Plus size={17} /> Abrir chamado
                </button>
              </div>
              <div className="stats">
                <article>
                  <span>Computadores online</span>
                  <strong>
                    {devices.filter((d) => d.online).length}
                    <Monitor />
                  </strong>
                  <small>de {devices.length} dispositivos autorizados</small>
                </article>
                <article>
                  <span>Chamados pendentes</span>
                  <strong>
                    {tickets.filter((t) => t.status !== "RESOLVIDO").length}
                    <TicketIcon />
                  </strong>
                  <small>abertos, em atendimento e aguardando</small>
                </article>
                <article>
                  <span>Em atendimento</span>
                  <strong>
                    {
                      tickets.filter((t) => t.status === "EM_ATENDIMENTO")
                        .length
                    }
                    <Radio />
                  </strong>
                  <small>trabalho em andamento</small>
                </article>
              </div>
              <section>
                <div className="section-title">
                  <h2>Fila de atendimento</h2>
                  <button onClick={() => nav("tickets")}>Ver todos →</button>
                </div>
                <TicketTable
                  items={tickets
                    .filter((t) => t.status !== "RESOLVIDO")
                    .slice(0, 6)}
                  open={(id) => void action(() => openTicket(id))}
                />
              </section>
              <div className="info-card">
                <ShieldCheck />
                <div>
                  <h3>Suporte remoto assistido</h3>
                  <p>
                    O colaborador autoriza a sessão no computador. A prova usa
                    janelas de até 60 segundos, com encerramento local pelo
                    MeshAgent. A integração Windows ainda requer homologação.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "devices" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PARQUE DE COMPUTADORES</span>
                  <h1>
                    Computadores <em>{devices.length}</em>
                  </h1>
                  <p>Último contato do agente define a disponibilidade.</p>
                </div>
                {admin && (
                  <button
                    className="primary"
                    onClick={() => {
                      setSelected(null);
                      setCode("");
                      setModal("device");
                    }}
                  >
                    <Plus size={17} /> Cadastrar computador
                  </button>
                )}
              </div>
              <div className="filters">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar nome, setor ou localidade"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Disponibilidade"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos os estados</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <LocationFilter
                  devices={devices}
                  value={location}
                  set={setLocation}
                />
              </div>
              <section className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Computador</th>
                      <th>Setor / localidade</th>
                      <th>Estado</th>
                      <th>Último contato</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevices.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="cell-title">
                            <Monitor size={19} />
                            <div>
                              <b>{d.name}</b>
                              <small>
                                {d.os || "Aguardando vínculo do agente"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {d.department}
                          <small>{d.location}</small>
                        </td>
                        <td>
                          <Badge
                            text={
                              d.revoked
                                ? "Revogado"
                                : d.online
                                  ? "Online"
                                  : "Offline"
                            }
                            tone={d.online ? "good" : "muted"}
                          />
                        </td>
                        <td>{date(d.last_seen)}</td>
                        <td>
                          <button
                            onClick={() => {
                              setSelected(d);
                              setModal("device-actions");
                            }}
                          >
                            Detalhes →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleDevices.length && (
                  <Empty
                    text={
                      loading
                        ? "Carregando computadores…"
                        : "Nenhum computador encontrado."
                    }
                  />
                )}
              </section>
            </>
          )}
          {page === "tickets" && !detail && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ATENDIMENTOS</span>
                  <h1>
                    Chamados <em>{tickets.length}</em>
                  </h1>
                  <p>
                    {staff
                      ? "Organize prioridades e acompanhe as solicitações."
                      : "Acompanhe suas solicitações e converse com o suporte."}
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("ticket")}>
                  <Plus size={17} /> Abrir chamado
                </button>
              </div>
              <div className="filters">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar chamado"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Estado"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos os estados</option>
                  {["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO", "RESOLVIDO"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                <select
                  aria-label="Prioridade"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Todas as prioridades</option>
                  {["BAIXA", "NORMAL", "ALTA", "URGENTE"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
                {staff && (
                  <select
                    aria-label="Técnico"
                    value={tech}
                    onChange={(e) => setTech(e.target.value)}
                  >
                    <option value="">Todos os técnicos</option>
                    {users
                      .filter((u) => u.role !== "SOLICITANTE")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                )}
                <LocationFilter
                  devices={devices}
                  value={location}
                  set={setLocation}
                />
              </div>
              <section>
                <TicketTable
                  items={visibleTickets}
                  open={(id) => void action(() => openTicket(id))}
                />
              </section>
              <small>Consulta limitada aos 500 chamados mais recentes.</small>
            </>
          )}
          {page === "tickets" && detail && (
            <>
              <button onClick={() => setDetail(null)}>
                <ArrowLeft size={16} /> Voltar aos chamados
              </button>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    CHAMADO #{detail.id.slice(0, 8)}
                  </span>
                  <h1>{detail.title}</h1>
                  <p>
                    {detail.category} · Aberto em {date(detail.created_at)}
                  </p>
                </div>
                <Badge text={labels[detail.status]} />
              </div>
              <div className="detail-grid">
                <section className="padded">
                  <h2>Solicitação</h2>
                  <p className="prewrap">{detail.description}</p>
                  <h2>Histórico e comentários</h2>
                  {detail.events?.map((e) => (
                    <div className="event" key={e.id}>
                      <b>{e.author}</b>
                      <small>{date(e.created_at)}</small>
                      <p className="prewrap">{e.body}</p>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      const f = form(e);
                      const el = e.currentTarget;
                      void action(async () => {
                        await api(
                          "/tickets/" + detail.id + "/comments",
                          "POST",
                          f,
                        );
                        await openTicket(detail.id);
                        el.reset();
                      });
                    }}
                  >
                    <label>
                      Adicionar comentário
                      <textarea name="body" required maxLength={8000} />
                    </label>
                    <button className="primary" disabled={busy}>
                      Enviar comentário
                    </button>
                  </form>
                </section>
                <section className="padded">
                  <h2>Organização</h2>
                  {staff ? (
                    <form
                      key={detail.id + detail.status}
                      onSubmit={(e) => {
                        const f = form(e);
                        void action(async () => {
                          await api("/tickets/" + detail.id, "PUT", {
                            ...f,
                            technicianId: f.technicianId || null,
                          });
                          await openTicket(detail.id);
                          await refresh();
                        });
                      }}
                    >
                      <label>
                        Estado
                        <select name="status" defaultValue={detail.status}>
                          {[
                            "ABERTO",
                            "EM_ATENDIMENTO",
                            "AGUARDANDO",
                            "RESOLVIDO",
                          ].map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Prioridade
                        <select name="priority" defaultValue={detail.priority}>
                          {["BAIXA", "NORMAL", "ALTA", "URGENTE"].map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Técnico
                        <select
                          name="technicianId"
                          defaultValue={detail.technician_id ?? ""}
                        >
                          <option value="">Sem responsável</option>
                          {users
                            .filter((u) => u.role !== "SOLICITANTE" && u.active)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button disabled={busy} className="primary">
                        Salvar alterações
                      </button>
                    </form>
                  ) : (
                    <p>Prioridade: {labels[detail.priority]}</p>
                  )}
                  <h2>Computador vinculado</h2>
                  <p>
                    {devices.find((d) => d.id === detail.device_id)?.name ??
                      "Nenhum computador disponível"}
                  </p>
                  {staff &&
                    devices.find((d) => d.id === detail.device_id)?.online && (
                      <button
                        onClick={() => {
                          setSelected(
                            devices.find((d) => d.id === detail.device_id)!,
                          );
                          setModal("device-actions");
                        }}
                      >
                        Solicitar acesso remoto
                      </button>
                    )}
                  <h2>Sessões relacionadas</h2>
                  {detail.sessions?.map((s) => (
                    <p key={s.id}>
                      {labels[s.mode]} · {labels[s.status]}
                      <small>
                        {date(s.requested_at)} · {s.result}
                      </small>
                    </p>
                  ))}
                  {!detail.sessions?.length && (
                    <small>Nenhuma sessão relacionada.</small>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "users" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CONTROLE DE ACESSO</span>
                  <h1>Usuários e permissões</h1>
                  <p>
                    Permissões de computadores são gerenciadas em cada
                    dispositivo.
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("user")}>
                  <Plus size={17} /> Novo usuário
                </button>
              </div>
              <section className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Login</th>
                      <th>Perfil</th>
                      <th>Estado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.name}</b>
                        </td>
                        <td>{u.login}</td>
                        <td>
                          <select
                            aria-label={"Perfil de " + u.name}
                            value={u.role}
                            disabled={u.id === user.id || busy}
                            onChange={(e) =>
                              void action(async () => {
                                await api("/users/" + u.id, "PUT", {
                                  role: e.target.value,
                                  active: u.active,
                                });
                                await refresh();
                              })
                            }
                          >
                            {["ADMIN", "TECNICO", "SOLICITANTE"].map((s) => (
                              <option key={s} value={s}>
                                {labels[s]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{u.active ? "Ativo" : "Desativado"}</td>
                        <td>
                          <button
                            disabled={u.id === user.id || busy}
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {page === "remote" && session && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    ATENDIMENTO REMOTO · PROVA TÉCNICA
                  </span>
                  <h1>{selected?.name ?? "Computador remoto"}</h1>
                  <p>
                    {labels[session.mode]} · expiração:{" "}
                    {date(session.expires_at)}
                  </p>
                </div>
                <button
                  className="danger"
                  disabled={busy || !!session.ended_at}
                  onClick={() =>
                    void action(async () =>
                      setSession(
                        await api<RemoteSession>(
                          "/sessions/" + session.id + "/stop",
                          "POST",
                        ),
                      ),
                    )
                  }
                >
                  Encerrar solicitação
                </button>
              </div>
              <section className="remote-stage">
                <Monitor size={56} />
                <h2>{session.result === "EXPIRED_UNCONFIRMED" ? "Expirado • encerramento não confirmado" : (labels[session.status] ?? session.status)}</h2>
                <p>
                  O consentimento inicial ocorre no Uai Suporte Agent. O
                  MeshAgent solicitará uma segunda confirmação antes de
                  transmitir a tela.
                </p>
                {session.status === "CONSENTED" && !isDesktop && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      const tab = window.open("about:blank", "_blank");
                      if (tab) tab.opener = null;
                      void action(async () => {
                        try {
                          const link = await api<{ url: string }>(
                            "/sessions/" + session.id + "/launch",
                            "POST",
                          );
                          if (tab) tab.location.replace(link.url);
                          else
                            throw new Error(
                              "Permita pop-ups e solicite uma nova sessão.",
                            );
                          setSession(await api("/sessions/" + session.id));
                        } catch (e) {
                          tab?.close();
                          throw e;
                        }
                      });
                    }}
                  >
                    Abrir tela remota
                  </button>
                )}
                {session.status === "READY" && (
                  <p>
                    Aguarde a confirmação local na janela do MeshAgent.
                    O link emitido ainda não significa transmissão.
                  </p>
                )}
                {session.started_at && <p>Primeiro bloco de imagem no motor: {date(session.started_at)}</p>}
                {session.engine_seen_at && <p>Última confirmação do motor: {date(session.engine_seen_at)}</p>}
                {session.status === "ACTIVE" && <p>A imagem aparece na janela remota. A recepção pelo motor não comprova a renderização no navegador.</p>}
                {session.result && <small>Resultado: {session.result}</small>}
              </section>
              <div className="info-card">
                <ShieldCheck />
                <p>
                  A barra de privacidade do MeshAgent permite encerrar
                  localmente. Se houver falha de rede, o encerramento pelo
                  painel pode ficar pendente até a expiração no motor.
                </p>
              </div>
            </>
          )}
        </main>
        <footer>
          Uai Telecom{" "}
          <span>Uai Suporte · piloto 0.1 · dados reais, sem demonstração</span>
        </footer>
      </div>
      {modal && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Formulário"
          >
            <button
              className="close"
              onClick={() => {
                setModal("");
                setCode("");
                setHistory(null);
              }}
              aria-label="Fechar"
            >
              ×
            </button>
            {errorBox}
            {modal === "ticket" && (
              <>
                <h2>Abrir chamado</h2>
                <p>Conte o que aconteceu para agilizar seu atendimento.</p>
                <form
                  onSubmit={(e) => {
                    const f = form(e);
                    void action(async () => {
                      const t = await api<{ id: string }>("/tickets", "POST", {
                        ...f,
                        deviceId: f.deviceId || null,
                      });
                      setModal("");
                      await refresh();
                      await openTicket(t.id);
                    });
                  }}
                >
                  <label>
                    Título
                    <input name="title" required maxLength={200} />
                  </label>
                  <label>
                    Descrição
                    <textarea name="description" required maxLength={8000} />
                  </label>
                  <div className="fields">
                    <label>
                      Categoria
                      <select name="category">
                        <option>Conectividade</option>
                        <option>Sistema</option>
                        <option>Equipamento</option>
                        <option>Acesso</option>
                        <option>Outros</option>
                      </select>
                    </label>
                    <label>
                      Prioridade
                      <select name="priority" defaultValue="NORMAL">
                        {["BAIXA", "NORMAL", "ALTA", "URGENTE"].map((s) => (
                          <option key={s} value={s}>
                            {labels[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Computador (opcional)
                    <select name="deviceId">
                      <option value="">Sem vínculo</option>
                      {devices
                        .filter((d) => !d.revoked)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    Criar chamado
                  </button>
                </form>
              </>
            )}
            {modal === "user" && (
              <>
                <h2>Novo usuário</h2>
                <form
                  onSubmit={(e) => {
                    const f = form(e);
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
                    <input
                      name="login"
                      required
                      pattern="[a-zA-Z0-9._@-]{3,120}"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Senha inicial (14 a 72 bytes)
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={14}
                      maxLength={72}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Perfil
                    <select name="role">
                      <option value="SOLICITANTE">Solicitante</option>
                      <option value="TECNICO">Técnico</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    Cadastrar usuário
                  </button>
                </form>
              </>
            )}
            {modal === "device" && (
              <>
                <h2>
                  {selected ? "Editar computador" : "Cadastrar computador"}
                </h2>
                {code ? (
                  <div className="info-card">
                    <div>
                      <h3>Código de vínculo · válido por 10 minutos</h3>
                      <code className="enroll-code">{code}</code>
                      <p>
                        Informe este código no agente Windows. Ele só pode ser
                        usado uma vez e não será exibido novamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      const f = form(e);
                      void action(async () => {
                        const body = {
                          ...f,
                          ownerId: f.ownerId || null,
                          meshNode: f.meshNode || null,
                        };
                        if (selected) {
                          await api("/devices/" + selected.id, "PUT", body);
                          setModal("");
                        } else {
                          const d = await api<{ code: string }>(
                            "/devices",
                            "POST",
                            body,
                          );
                          setCode(d.code);
                        }
                        await refresh();
                      });
                    }}
                  >
                    <label>
                      Nome
                      <input
                        name="name"
                        defaultValue={selected?.name}
                        required
                        maxLength={120}
                      />
                    </label>
                    <div className="fields">
                      <label>
                        Setor
                        <input
                          name="department"
                          defaultValue={selected?.department}
                          required
                          maxLength={120}
                        />
                      </label>
                      <label>
                        Localidade
                        <input
                          name="location"
                          defaultValue={selected?.location}
                          required
                          maxLength={120}
                        />
                      </label>
                    </div>
                    <label>
                      Responsável
                      <select
                        name="ownerId"
                        defaultValue={selected?.owner_id ?? ""}
                      >
                        <option value="">Sem responsável</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Node ID do MeshCentral (opcional)
                      <input
                        name="meshNode"
                        defaultValue={selected?.mesh_node ?? ""}
                        placeholder="node//..."
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      {selected ? "Salvar" : "Cadastrar e gerar vínculo"}
                    </button>
                  </form>
                )}
              </>
            )}
            {modal === "device-actions" && selected && (
              <>
                <span className="eyebrow">COMPUTADOR</span>
                <h2>{selected.name}</h2>
                <p>
                  {selected.department} · {selected.location}
                </p>
                <Badge
                  text={
                    selected.revoked
                      ? "Revogado"
                      : selected.online
                        ? "Online"
                        : "Offline"
                  }
                  tone={selected.online ? "good" : "muted"}
                />
                {isDesktop && <p>Prova desktop: solicitações remotas desativadas até validar login e logout.</p>}
                {staff && (
                  <div className="actions">
                    <button
                      disabled={isDesktop || !selected.online || busy}
                      onClick={() => void requestRemote(selected, "VIEW")}
                    >
                      Solicitar visualização
                    </button>
                    <button
                      className="primary"
                      disabled={isDesktop || !selected.online || busy}
                      onClick={() => void requestRemote(selected, "CONTROL")}
                    >
                      Solicitar controle
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () =>
                          setHistory(
                            await api("/devices/" + selected.id + "/history"),
                          ),
                        )
                      }
                    >
                      Histórico de atendimentos
                    </button>
                  </div>
                )}
                {admin && (
                  <>
                    <hr />
                    <h3>Administração</h3>
                    <div className="actions">
                      <button onClick={() => setModal("device")}>
                        Editar cadastro
                      </button>
                      <button
                        disabled={selected.revoked || busy}
                        onClick={() =>
                          void action(async () => {
                            const d = await api<{ code: string }>(
                              "/devices/" + selected.id + "/enrollment",
                              "POST",
                            );
                            setCode(d.code);
                          })
                        }
                      >
                        Renovar código de vínculo
                      </button>
                      <button
                        className="danger"
                        disabled={selected.revoked || busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Revogar este agente e encerrar suas sessões?",
                            )
                          )
                            void action(async () => {
                              await api(
                                "/devices/" + selected.id + "/revoke",
                                "POST",
                              );
                              setModal("");
                              await refresh();
                            });
                        }}
                      >
                        Revogar dispositivo
                      </button>
                    </div>
                    {code && <code className="enroll-code">{code}</code>}
                    <h3>Permissão por técnico</h3>
                    <form
                      onSubmit={(e) => {
                        const f = form(e);
                        void action(async () => {
                          if (f.permission === "NONE")
                            await api(
                              "/devices/" +
                                selected.id +
                                "/permissions/" +
                                f.userId,
                              "DELETE",
                            );
                          else
                            await api(
                              "/devices/" + selected.id + "/permissions",
                              "PUT",
                              {
                                userId: f.userId,
                                control: f.permission === "CONTROL",
                              },
                            );
                          setModal("");
                          await refresh();
                        });
                      }}
                    >
                      <label>
                        Técnico
                        <select name="userId" required>
                          <option value="">Selecione</option>
                          {users
                            .filter((u) => u.role === "TECNICO" && u.active)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Acesso
                        <select name="permission">
                          <option value="VIEW">Somente visualizar</option>
                          <option value="CONTROL">
                            Visualizar e controlar
                          </option>
                          <option value="NONE">Remover permissão</option>
                        </select>
                      </label>
                      <button disabled={busy}>Aplicar permissão</button>
                    </form>
                  </>
                )}
                {history && (
                  <>
                    <hr />
                    <h3>Histórico do computador</h3>
                    {history.tickets.map((t) => (
                      <p key={t.id}>
                        {t.title} · {labels[t.status]}
                      </p>
                    ))}
                    {history.sessions.map((s) => (
                      <p key={s.id}>
                        {date(s.requested_at)} · {labels[s.mode]}
                        <small>
                          {labels[s.status]} · {s.result}
                        </small>
                      </p>
                    ))}
                    {!history.tickets.length && !history.sessions.length && (
                      <Empty text="Nenhum atendimento registrado." />
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Badge({ text, tone = "neutral" }: { text: string; tone?: string }) {
  return (
    <span className={"badge " + tone}>
      <i />
      {text}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <TicketIcon size={26} />
      <p>{text}</p>
    </div>
  );
}
function LocationFilter({
  devices,
  value,
  set,
}: {
  devices: Device[];
  value: string;
  set: (v: string) => void;
}) {
  return (
    <select
      aria-label="Localidade"
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="">Todas as localidades</option>
      {[...new Set(devices.map((d) => d.location))].map((l) => (
        <option key={l}>{l}</option>
      ))}
    </select>
  );
}
function TicketTable({
  items,
  open,
}: {
  items: Ticket[];
  open: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Chamado</th>
            <th>Solicitante</th>
            <th>Prioridade</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.title}</b>
                <small>
                  #{t.id.slice(0, 8)} · {t.category}
                </small>
              </td>
              <td>{t.requester_name ?? "—"}</td>
              <td>
                <Badge
                  text={labels[t.priority]}
                  tone={
                    ["ALTA", "URGENTE"].includes(t.priority) ? "warn" : "muted"
                  }
                />
              </td>
              <td>
                <Badge
                  text={labels[t.status]}
                  tone={t.status === "RESOLVIDO" ? "good" : "neutral"}
                />
              </td>
              <td>
                <button onClick={() => open(t.id)}>Abrir →</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty text="Nenhum chamado nesta lista." />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
