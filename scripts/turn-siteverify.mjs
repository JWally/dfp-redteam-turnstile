#!/usr/bin/env node
/** turn-siteverify.mjs — probe Turnstile's SERVER-side boundary (Siteverify)
 *  with Cloudflare's PUBLIC test secret. Shows the test key is permissive
 *  (result_with_testing_key) — any token passes — while block/interactive
 *  test secrets are rejected. Production tokens remain server-validated,
 *  single-use, 300s TTL. */
const SECRET = '1x0000000000000000000000000000000AA'; // docs.cloudflare.com test secret

async function verify(label, secret, response) {
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response }),
  });
  const j = await r.json();
  console.log(`[${label}] HTTP ${r.status} success=${j.success} error-codes=${JSON.stringify(j['error-codes'])} metadata=${JSON.stringify(j.metadata)}`);
}

console.log('=== TURNSTILE Siteverify boundary (public test secrets) ===\n');
await verify('pass-secret + dummy token        ', SECRET, 'XXXX.DUMMY.TOKEN.XXXX');
await verify('pass-secret + TAMPERED garbage    ', SECRET, 'TAMPERED.token.deadbeef');
await verify('pass-secret + replayed x2         ', SECRET, '0.abcREALlookingTOKEN123');
await verify('fail-secret (block test key)      ', '2x0000000000000000000000000000000AB', 'XXXX.DUMMY.TOKEN.XXXX');
await verify('interactive-secret                ', '3x0000000000000000000000000000000FF', 'XXXX.DUMMY.TOKEN.XXXX');
console.log('\n=> test key accepts anything (result_with_testing_key); production validate content + single-use.');
