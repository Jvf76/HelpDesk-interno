// Execute somente contra banco descartável. Não representa atendimento real.
import { chromium } from "playwright";
const base = process.env.UAI_E2E_BASE_URL || "http://127.0.0.1:5173";
const login = process.env.UAI_E2E_LOGIN;
const password = process.env.UAI_E2E_PASSWORD;
if (!login || !password || process.env.UAI_E2E_DISPOSABLE_DATABASE !== "true")
  throw Error(
    "Use banco descartável: defina UAI_E2E_LOGIN, UAI_E2E_PASSWORD e UAI_E2E_DISPOSABLE_DATABASE=true. O teste cria usuários e chamados identificados como teste.",
  );
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByLabel("Login", { exact: true }).fill(login);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Abrir chamado", exact: true })
    .click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("TESTE AUTOMATIZADO — fluxo de chamado");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill(
      "Registro exclusivo do banco descartável de teste; não representa incidente real.",
    );
  await page
    .getByRole("button", { name: "Criar chamado", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "TESTE AUTOMATIZADO — fluxo de chamado",
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Adicionar comentário")
    .fill("Comentário de verificação ponta a ponta.");
  await page
    .getByRole("button", { name: "Enviar comentário", exact: true })
    .click();
  await page
    .getByText("Comentário de verificação ponta a ponta.", { exact: true })
    .waitFor();
  await page.locator('select[name="status"]').selectOption("RESOLVIDO");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByText("Estado: ABERTO → RESOLVIDO", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Computadores", exact: true }).click();
  await page
    .getByText("Nenhum computador encontrado.", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const requesterLogin = "requester-" + Date.now();
  const testPassword = password;
  await page.evaluate(
    async ({ login, password }) => {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      const r = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrf,
        },
        body: JSON.stringify({
          name: "SOLICITANTE TESTE AUTOMATIZADO",
          login,
          password,
          role: "SOLICITANTE",
        }),
      });
      if (!r.ok) throw Error("Falha ao criar solicitante de teste");
    },
    { login: requesterLogin, password: testPassword },
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page
    .getByRole("heading", { name: "Bem-vindo de volta", exact: true })
    .waitFor();
  await page.getByLabel("Login", { exact: true }).fill(requesterLogin);
  await page.getByLabel("Senha", { exact: true }).fill(testPassword);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Chamados", exact: true }).click();
  await page
    .getByText("Nenhum chamado nesta lista.", { exact: true })
    .waitFor();
  if (
    await page
      .getByText("TESTE AUTOMATIZADO — fluxo de chamado", { exact: true })
      .count()
  )
    throw Error("Cache de outra identidade exibido");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page
    .getByRole("heading", { name: "Bem-vindo de volta", exact: true })
    .waitFor();
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: login, dashboard vazio real, criar chamado, comentário, resolver, dispositivos vazios, viewport móvel, logout e troca de identidade sem dados da sessão anterior; zero erros JS.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
