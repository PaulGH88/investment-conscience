// Regression test: tapping the narrator avatar to hide it must keep it hidden for the
// whole slide sequence (Paul, 2026-10-01). Runs the REAL index.html in headless Chrome
// over a local static server and drives the real DOM - no mirrored logic.
// Covers the desktop click path (Next/Prev); touch/swipe/autoplay paths were probed by hand in the Paired-Check.
// Run: node tests/narrator-panel-dismiss.test.mjs   (needs Chrome and network for three.js)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html', '.mp3':'audio/mpeg', '.mp4':'video/mp4', '.jpg':'image/jpeg', '.png':'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'ic-test-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find(x => x.type === 'page'); if (pg) return pg; } catch {}
    await sleep(250);
  }
  throw new Error('Chrome did not start');
}
const target = await cdpTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); if (!ok) failed++; };
const shown = () => ev(`document.getElementById('ninaWrap').classList.contains('show')`);
const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const counter = () => ev(`document.getElementById('counter').textContent`);
const narrating = () => ev(`[...document.querySelectorAll('video,audio')].some(e => !e.paused && !e.ended)`);

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  // wait for the module script to finish wiring the UI (three.js comes from a CDN)
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) { await sleep(500); ready = await ev(`!!document.getElementById('btnNarrator') && document.getElementById('btnNarrator').textContent.trim().length > 0 && typeof document.getElementById('next').onclick === 'function'`).catch(() => false); }
  if (!ready) throw new Error('page never wired up (is three.js reachable?)');
  await sleep(1500);

  check('starts audio-only: panel hidden', (await shown()) === false);
  await click('#btnNarrator');            // -> Paul
  await click('#btnNarrator');            // -> Nina
  await sleep(300);
  check('Nina selected: panel shown on slide 1', (await shown()) === true);
  check('button reads Nina', /nina/i.test(await ev(`document.getElementById('btnNarrator').textContent`)));

  await click('#ninaWrap');               // Paul taps her avatar away
  check('tap hides the avatar on slide 1', (await shown()) === false);

  await sleep(600);
  check('narration keeps playing after the tap', (await narrating()) === true);

  for (let n = 2; n <= 4; n++) {
    const before = await counter();
    await click('#next'); await sleep(400);
    check(`slide ${n} really changed`, (await counter()) !== before);
    check(`avatar STAYS hidden on slide ${n}`, (await shown()) === false);
  }
  const beforePrev = await counter();
  await click('#prev'); await sleep(300);
  check('prev really changed the slide', (await counter()) !== beforePrev);
  check('avatar stays hidden going back a slide', (await shown()) === false);

  await click('#btnNarrator');            // Nina -> audio-only
  await click('#btnNarrator');            // -> Paul : explicit narrator change reopens
  await sleep(300);
  check('cycling the narrator button reopens the panel', (await shown()) === true);
  await click('#next'); await sleep(400);
  check('reopened panel persists to the next slide', (await shown()) === true);
} catch (e) {
  console.log('ERROR ' + e.message); failed++;
} finally {
  try { ws.close(); } catch {} chrome.kill(); server.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
