const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAuthenticodeHandler } = require('../node_modules/meshcentral/authenticode');

test('Unicode description produces parseable DER and invalid timestamp remains rejected',
 {skip: !process.env.UAI_MESH_UNSIGNED_AGENT, timeout: 15000}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uai-sign-test-'));
  let requests = 0;
  const server = http.createServer((req,res) => {
    requests++; req.resume(); res.writeHead(200); res.end('not-a-valid-timestamp');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const output = path.join(dir,'never-install.exe');
  const handler = createAuthenticodeHandler(process.env.UAI_MESH_UNSIGNED_AGENT);
  try {
    const error = await new Promise(resolve => handler.sign(null, {
      out: output, desc: 'Uai Suporte — laboratório remoto', url: 'https://mesh.internal',
      time: `http://127.0.0.1:${server.address().port}/timestamp`
    }, resolve));
    assert.equal(requests, 1, 'must pass strict DER parsing before contacting timestamp service');
    assert.match(String(error), /Unable to parse time-stamp response/);
    assert.equal(fs.existsSync(output), false, 'invalid timestamp must not produce an approved executable');
  } finally {
    if (handler.close) handler.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, {recursive:true,force:true});
  }
});
