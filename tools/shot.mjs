// Headless screenshots for EMBER VAULT via Chrome DevTools Protocol (Node 22+ WebSocket,
// no extra dependencies). Serves game/ with serve.ts, loads each ?shot= scene, waits for
// window.__shotReady, captures a JPEG. Also does a plain boot check collecting console errors.
// Usage: node tools/shot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8901;
const DEBUG_PORT = 9223;
const SHOTS = [
  { name: '1-cover.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-loot.jpg', query: '?shot=loot&seed=1' },
  { name: '4-win.jpg', query: '?shot=win&seed=1' },
];
const here = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const j = await res.json();
      return j.webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('chrome devtools did not come up');
}

let msgId = 0;
const pending = new Map();
function send(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--no-sandbox', '--disable-gpu',
    '--window-size=1280,800', '--user-data-dir=/tmp/ember-vault-profile', 'about:blank',
  ], { stdio: 'ignore' });
  const errors = [];
  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const events = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id).resolve(m.result);
        pending.delete(m.id);
      } else if (m.method === 'Runtime.exceptionThrown') {
        errors.push(`EXCEPTION: ${m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '?'}`);
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(`CONSOLE ERROR: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      } else if (m.method) {
        events.push(m.method);
      }
    };
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    const sendS = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ sessionId, id, method, params }));
    });
    await sendS('Runtime.enable');
    await sendS('Page.enable');
    await sendS('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    async function shot(url, outName) {
      await sendS('Page.navigate', { url });
      const t0 = Date.now();
      let ready = false;
      while (Date.now() - t0 < 15000) {
        const r = await sendS('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
        if (r.result?.value) { ready = true; break; }
        await sleep(200);
      }
      if (!ready) throw new Error(`shot ${outName} never became ready`);
      await sleep(150);
      const shotRes = await sendS('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      writeFileSync(join(here, 'screenshots', outName), Buffer.from(shotRes.data, 'base64'));
      console.log(`wrote screenshots/${outName}`);
    }

    // Boot check: plain load, no shot param.
    await sendS('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await sleep(2000);
    const boot = await sendS('Runtime.evaluate', {
      expression: '({ hasGame: !!window.__game, title: document.title })',
      returnByValue: true,
    });
    console.log('boot:', JSON.stringify(boot.result?.value), 'console errors:', errors.length);
    for (const e of errors) console.log(' ', e);

    for (const s of SHOTS) await shot(`http://127.0.0.1:${PORT}/${s.query}`, s.name);
    console.log('console errors total:', errors.length);
    if (errors.length) process.exitCode = 2;
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
