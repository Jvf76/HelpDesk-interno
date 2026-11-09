// Exercises bundled upstream codec and input adapter, using a simulated WSS endpoint.
// This is NOT a Windows capture or a real remote session.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const web=process.argv.includes("--web");
const root = path.resolve(web?"dist/remote-viewer":"../desktop/UaiSuporte.App/Viewer");
const browser = await chromium.launch({ headless: true });
try {
  for (const viewOnly of [true, false]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, "https://mesh.internal");
      const file = path.join(root, url.pathname.replace("/uai-viewer/", ""));
      await route.fulfill({
        body: await fs.readFile(file),
        contentType: file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      });
    });
    await page.addInitScript(() => {
      window.events = [];
      window.sent = [];
      window.deliver = null;
      window.chrome = {
        webview: {
          postMessage: (m) => window.events.push(m),
          addEventListener: (_, fn) => (window.deliver = fn),
        },
      };
      window.WebSocket = class {
        static OPEN = 1;
        constructor(url) {
          this.readyState = 1;
          window.socket = this;
          window.socketUrl = url;
          setTimeout(() => this.onopen?.(), 0);
        }
        send(data) {
          window.sent.push(
            typeof data === "string" ? data : Array.from(new Uint8Array(data)),
          );
        }
        close() {
          this.closed = true;
        }
      };
    });
    if(web)await page.addInitScript(()=>{
      window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.uaiViewer&&e.data.kind)window.events.push(e.data);});
    });
    await page.goto("https://mesh.internal/uai-viewer/index.html");
    await page.click('#fullscreen');
    await page.waitForFunction(()=>!!document.fullscreenElement);
    assert.equal(await page.locator('#fullscreen').textContent(),'Sair da tela cheia');
    await page.click('#fullscreen');
    await page.waitForFunction(()=>!document.fullscreenElement);
    if(web)await page.evaluate(()=>{window.deliver=({data})=>window.postMessage({uaiViewer:true,payload:data},location.origin);});
    await page.evaluate(
      (viewOnly) =>
        window.deliver({
          data: {
            action: "start",
            authCookie: "simulated-token",
            viewOnly,
            expiresAt: Date.now() + 180000,
          },
        }),
      viewOnly,
    );
    await page.waitForFunction(()=>!!window.socketUrl);
    assert.match(
      await page.evaluate(() => window.socketUrl),
      /^wss:\/\/mesh\.internal\/meshrelay\.ashx\?/,
    );
    assert.match(await page.locator('#mode').innerText(),/solicitad[ao]/);
    await page.evaluate(()=>{
      window.socket.onmessage({data:"c"});
      window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'console',msgid:1,msg:'fixture'})});
      window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'rtt',time:Date.now()-43})});
      window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'metadata',uaiActiveUntil:Date.now()+5000})});
    });
    await page.waitForFunction(()=>document.getElementById('metrics').textContent.includes('ms'));
    assert.match(await page.locator('#state').innerText(),/Aguardando confirmação no computador acessado/);
    assert.doesNotMatch(await page.locator('#mode').innerText(),/Controle autorizado|Controle ativo/);
    await page.keyboard.press("a");
    assert.deepEqual(await page.evaluate(()=>window.sent.filter(x=>Array.isArray(x)&&[1,2,85].includes((x[0]<<8)|x[1]))),[]);
    await page.evaluate(()=>{
      window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'console',msgid:0})});
    });
    assert.match(await page.locator('#state').innerText(),/Acesso autorizado — aguardando imagem/);
    await page.evaluate(() => {
      window.socket.onmessage({
        data: new Uint8Array([0, 7, 0, 8, 0, 32, 0, 32]).buffer,
      });
      const image = document.createElement("canvas");
      image.width = image.height = 32;
      const ctx = image.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 32, 32);
      const bytes = Uint8Array.from(
        atob(image.toDataURL("image/jpeg").split(",")[1]),
        (c) => c.charCodeAt(0),
      );
      const packet = new Uint8Array(bytes.length + 8);
      packet.set([0, 3, packet.length >> 8, packet.length & 255, 0, 0, 0, 0]);
      packet.set(bytes, 8);
      window.socket.onmessage({ data: packet.buffer });
    });
    await page.waitForFunction(() =>
      window.events.some((e) => e.kind === "frame"),
    );
    assert(
      (await page.evaluate(
        () =>
          document
            .querySelector("canvas")
            .getContext("2d")
            .getImageData(10, 10, 1, 1).data[0],
      )) > 200,
    );
    // Drawing alone cannot enable input; the relay must confirm all authorization gates.
    await page.locator("canvas").click({position:{x:10,y:10}});await page.keyboard.press("a");
    assert.deepEqual(await page.evaluate(()=>window.sent.filter(x=>Array.isArray(x)&&[1,2,85].includes((x[0]<<8)|x[1]))),[]);
    assert.doesNotMatch(await page.locator('#mode').innerText(),/Controle ativo/);
    await page.evaluate(()=>window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'metadata',uaiActiveUntil:Date.now()+60000})}));
    assert.equal(await page.locator('#state').innerText(),viewOnly?'Visualização ativa':'Controle ativo');
    await page.evaluate(()=>window.socket.onmessage({data:new Uint8Array([0,11,0,12,0,2,0,1,0,2,0,1]).buffer}));
    assert.equal(await page.locator('#monitor option').count(),2);
    assert.match(await page.locator('#monitor-status').innerText(),/2 monitores/);
    await page.getByRole('button',{name:'Atualizar monitores'}).click();
    assert(await page.evaluate(()=>window.sent.some(x=>Array.isArray(x)&&x[1]===11)), 'monitor query missing');
    await page.selectOption('#monitor','2');
    assert(await page.evaluate(()=>window.sent.some(x=>Array.isArray(x)&&x[1]===12&&x[5]===2)), 'monitor switch command missing');
    // Real adapter consumes the SDK RTT callback and sends the existing quality command.
    await page.evaluate(() => {
      for (let i=0;i<2;i++) window.socket.onmessage({data:JSON.stringify({ctrlChannel:102938,type:'rtt',time:Date.now()-400})});
    });
    await page.waitForFunction(() => document.getElementById('metrics').textContent.includes('Economia'));
    await page.selectOption('#quality', 'fluid');
    assert(await page.evaluate(()=>window.sent.some(x=>Array.isArray(x)&&x[1]===5&&x[5]===45&&x[8]===0&&x[9]===33)), 'fluid capture interval missing');
    await page.selectOption('#quality', 'clarity');
    assert(await page.evaluate(() => window.sent.some(x => Array.isArray(x) && x[1]===5 && x[5]===75)), 'quality command missing');
    const before = await page.evaluate(() => window.sent.length);
    await page.locator("canvas").click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("a");
    const after = await page.evaluate(() => window.sent.length);
    const input = await page.evaluate(start => window.sent.slice(start).filter(x => Array.isArray(x) && [1,2,85].includes((x[0]<<8)|x[1])).map(x => (x[0]<<8)|x[1]), before);
    if (viewOnly) assert.deepEqual(input, [], "VIEW sent input");
    else {assert(input.includes(2), "CONTROL missing mouse");assert(input.includes(1)||input.includes(85), "CONTROL missing keyboard");}
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    assert.equal(await page.evaluate(() => window.socket.closed), true);
    assert.equal(
      await page.evaluate(
        () =>
          document
            .querySelector("canvas")
            .getContext("2d")
            .getImageData(10, 10, 1, 1).data[3],
      ),
      0,
    );
    await page.evaluate(()=>window.socket.onmessage({data:JSON.stringify({ctrlChannel:"102938",type:"metadata",uaiActiveUntil:Date.now()+30000})}));
    assert.equal(await page.locator("#mode").innerText(),"Entrada bloqueada");
    const stopped = await page.evaluate(() => window.sent.length);
    await page.keyboard.press("b");
    assert.equal(await page.evaluate(() => window.sent.length), stopped);
    // A relay that never produces an image must not leave the viewer connecting forever.
    await page.clock.install();
    await page.evaluate(()=>window.deliver({data:{action:"start",authCookie:"simulated-timeout",viewOnly:false,expiresAt:Date.now()+60000}}));
    await page.waitForFunction(()=>window.socketUrl.includes("simulated-timeout"));
    await page.clock.fastForward(21000);
    await page.waitForFunction(()=>window.events.some(e=>e.kind==="connection-timeout"));
    assert.equal(await page.evaluate(()=>window.socket.closed),true);
    assert.match(await page.locator('#state').innerText(),/Tentativa encerrada/);
    await page.evaluate(()=>window.deliver({data:{action:"start",authCookie:"simulated-native-consent",viewOnly:false,expiresAt:Date.now()+60000}}));
    await page.waitForFunction(()=>window.socketUrl.includes('simulated-native-consent'));
    await page.evaluate(()=>{window.socket.onmessage({data:'c'});window.socket.onmessage({data:JSON.stringify({ctrlChannel:'102938',type:'console',msgid:1,msg:'fixture'})});});
    await page.clock.fastForward(21000);
    assert.notEqual(await page.evaluate(()=>window.socket.closed),true,'native consent timeout cut short');
    assert.match(await page.locator('#state').innerText(),/confirmação no computador acessado/);
    await page.clock.fastForward(15000);
    assert.equal(await page.evaluate(()=>window.socket.closed),true,'native consent must remain bounded');
    assert.match(await page.locator('#state').innerText(),/confirmação.*expirou/);
    assert(await page.evaluate(()=>window.events.some(e=>e.kind==='engine-consent-timeout')));
    for(const [code,kind] of [[1000,'transport-close-normal'],[1006,'transport-close-abnormal'],[1008,'transport-close-other']]){
      await page.evaluate(code=>window.deliver({data:{action:'start',authCookie:'simulated-close-'+code,viewOnly:true,expiresAt:Date.now()+60000}}),code);
      await page.waitForFunction(code=>window.socketUrl.includes('simulated-close-'+code),code);
      await page.evaluate(code=>window.socket.onclose({code,reason:'SECRET-NOT-FOR-DIAGNOSTICS'}),code);
      await page.waitForFunction(kind=>window.events.some(e=>e.kind===kind),kind);
      assert(!(await page.evaluate(()=>JSON.stringify(window.events))).includes('SECRET-NOT-FOR-DIAGNOSTICS'));
      assert.equal(await page.evaluate(()=>window.socket.closed),true);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Viewer: JPEG real decodificado no canvas, VIEW sem entrada, CONTROL envia entrada, stop fecha socket e limpa imagem. Transporte simulado; sem Windows real.",
  );
} finally {
  await browser.close();
}
