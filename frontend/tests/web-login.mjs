// Browser login regression with mocked API; not a live-server test.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("dist");
const browser = await chromium.launch({ headless: true });
let assertions = 0;
try {
  for (const mode of ["online", "offline", "tls"]) {
    const page = await browser.newPage();
    const errors = [];
    let logged = false;
    const calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const respond = async (r) => {
      calls.push(r);
      let status = 200,
        body = {};
      const user = {
        id: "test",
        name: "Técnico de teste",
        role: "SOLICITANTE",
        csrf: "test-csrf",
      };
      if (mode === "offline") {
        status = 503;
        body = {
          message: "Servidor indisponível. Interface local disponível.",
        };
      } else if (mode === "tls") {
        status = 495;
        body = { message: "Certificado TLS não confiável. Conexão bloqueada." };
      } else if (r.path === "/auth/login") {
        logged = true;
        body = user;
      } else if (r.path === "/auth/logout") {
        assert.equal(r.csrf, "test-csrf");
        logged = false;
      } else if (r.path === "/auth/me") {
        status = logged ? 200 : 401;
        body = logged ? user : { message: "Entre novamente" };
      } else body = [];
      return { id: r.id, status, body: JSON.stringify(body) };
    };
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, "https://uai-suporte.invalid");
      if(url.pathname.startsWith("/api/")) {
        const body=route.request().postDataJSON();
        const r=await respond({path:url.pathname.substring(4),body,method:route.request().method(),csrf:route.request().headers()["x-csrf-token"]});
        await route.fulfill({status:r.status,body:r.body,contentType:"application/json"});return;
      }
      const file = path.join(
        root,
        url.pathname === "/index.html" ? "index.html" : url.pathname,
      );
      await route.fulfill({
        body: await fs.readFile(file),
        contentType: file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
        headers: {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
        },
      });
    });
    await page.goto("https://uai-suporte.invalid/index.html");
    await page.getByLabel("Login", { exact: true }).waitFor();
    if (mode === "online") {
      assert.equal(
        await page.getByText("Sessão expirada. Entre novamente.").count(),
        0,
      );
      assertions++;
      await page.getByLabel("Login", { exact: true }).fill("test");
      await page.getByLabel("Senha", { exact: true }).fill("test");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page
        .getByRole("heading", { name: "Seu código e conexão", exact: true })
        .waitFor();
      assertions++;
      await page.getByRole("heading",{name:"Seu código",exact:true}).waitFor();
      await page.getByRole("heading",{name:"Conectar a outro computador",exact:true}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Solicitar conexão",exact:true}).isEnabled(),false);
      assert.equal(calls.some(c=>c.path==="/users"),false);
      assertions+=4;
      await page.getByTitle("Sair", { exact: true }).click();
      await page.getByLabel("Login", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("Chamados", { exact: true }).count(),
        0,
      );
      assert.equal(logged, false);
      assert.equal(
        await page.getByText("Sessão expirada. Entre novamente.").count(),
        0,
      );
      assertions += 2;
      assert(
        calls.some((c) => c.path === "/auth/logout" && c.csrf === "test-csrf"),
      );
      assertions++;
    } else {
      await page
        .getByRole("alert")
        .filter({
          hasText: mode === "tls" ? "Certificado TLS" : "Servidor indisponível",
        })
        .waitFor();
      assertions++;
    }
    assert.deepEqual(errors, []);
    assertions++;
    await page.close();
  }
  console.log(
    assertions +
      " verificações do login web passaram com API simulada.",
  );
} finally {
  await browser.close();
}
