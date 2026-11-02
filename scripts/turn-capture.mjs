#!/usr/bin/env node
/** turn-capture.mjs — drive Cloudflare Turnstile with the PUBLIC test sitekeys
 *  (docs.cloudflare.com) and capture the full client flow:
 *    - api.js load, the /cdn-cgi/challenge-platform/ iframe + scripts
 *    - the postMessage protocol, the token (cf-turnstile-response)
 *    - the challenge outcome (pass vs interactive)
 *  Sitekeys: 1x...AA always-pass, 2x...AB always-block, 3x...FF forces interactive. */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

const SITEKEY = process.argv[2] || '1x00000000000000000000AA';
const TAG = process.argv[3] || 'pass';
const OUT = `/tmp/opencode/turnstile/cap-${TAG}`;
mkdirSync(OUT, { recursive: true });

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><head>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
</head><body>
<div id="ts"></div>
<script>
  window.__ts = { calls: [], token: null, error: null };
  function render(){
    if(!window.turnstile){ return setTimeout(render, 100); }
    turnstile.render('#ts', {
      sitekey: '${SITEKEY}',
      callback: (t)=>{ window.__ts.token = t; },
      'error-callback': (e)=>{ window.__ts.error = String(e); },
      'before-interactive-callback': ()=>{ window.__ts.calls.push('before-interactive'); },
    });
  }
  window.addEventListener('load', render);
</script></body></html>`);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const reqs = [];
page.on('request', (req) => {
  const u = req.url();
  if (/challenges\.cloudflare\.com|challenge-platform/.test(u)) reqs.push({ t: 'REQ', m: req.method(), u, body: (req.postData() || '').slice(0, 500) });
});
page.on('response', async (res) => {
  const u = res.url();
  if (/challenges\.cloudflare\.com|challenge-platform/.test(u)) reqs.push({ t: 'RES', s: res.status(), u, setCookie: res.headers()['set-cookie'] || null });
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15000);

const state = await page.evaluate(() => ({
  token: window.__ts.token,
  error: window.__ts.error,
  calls: window.__ts.calls,
  hidden: [...document.querySelectorAll('[name=cf-turnstile-response]')].map(e => e.value),
})).catch(e => ({ err: String(e).slice(0, 150) }));

writeFileSync(OUT + '/result.json', JSON.stringify({ sitekey: SITEKEY, reqs, state }, null, 2));
console.log(`=== TURNSTILE [${TAG}] sitekey=${SITEKEY} ===`);
console.log('token :', JSON.stringify(state.token));
console.log('error :', JSON.stringify(state.error));
console.log('calls :', JSON.stringify(state.calls));
console.log('\ncloudflare requests:');
for (const r of reqs) {
  if (r.t === 'RES') console.log(`  RES ${r.s} ${r.u.slice(0, 110)}${r.setCookie ? '  set-cookie=' + r.setCookie.slice(0, 60) : ''}`);
  else console.log(`  ${r.m} ${r.u.slice(0, 110)}${r.body ? '  body=' + r.body.slice(0, 120) : ''}`);
}
srv.close(); await b.close();
