# Cloudflare Turnstile — client dissection (2026-11-02)

Authorized dissection using Cloudflare's **public test sitekeys** (from the
official docs). Only public page loads; no production token forged, replayed,
farmed, or used against any protected endpoint.

## 1. Loader

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="cf-turnstile" data-sitekey="<SITEKEY>"></div>
```

`/turnstile/v0/api.js` 302s to a versioned build
(`/turnstile/v0/b/d0d7f3571048/api.js`). Cloudflare requires this URL be used
verbatim — proxying or caching it breaks future updates.

## 2. Widget + challenge platform

Rendering the widget creates an iframe whose `src` is served from the
**same-origin** path:

```
/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/<random>/<sitekey>/auto/fbE/new/normal?lang=auto
```

That frame is the Challenge Platform (the same machinery behind Cloudflare's
"Just a moment…" WAF challenge and `cf_clearance`). Turnstile's own docs state
the non-interactive challenges are: **proof-of-work, proof-of-space, Web-API
probing, and browser-quirk / human-behaviour** heuristics; the difficulty adapts
per request. Results are posted back to the parent via `postMessage`.

## 3. Outcome per (public) test key — observed

| sitekey | mode | observed |
|---|---|---|
| `1x00000000000000000000AA` | always pass | `cf-turnstile-response = "XXXX.DUMMY.TOKEN.XXXX"` |
| `3x00000000000000000000FF` | force interactive | `before-interactive` callback fires, **no token** issued headless > challenge wall |
| `2x00000000000000000000AB` | always block | (block variant) |

## 4. The token — why it isn't forgeable

- **Single use**: a replayed token is rejected with `timeout-or-duplicate`.
- **300 s TTL** from generation.
- **Server-side validation**: the merchant's backend must call
  `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with the
  **secret key** + token (+ optional `remoteip`). The response returns
  `success`, `action`, `hostname`, etc.
- The **secret key never ships to the client**, and the token is an opaque,
  server-checked value → **the client cannot mint or forge a valid token.**

## 5. How it is actually bypassed (not by forging)

The known working approach is to **legitimately solve** the challenge in a real
(patched) browser. The public [`Theyka/Turnstile-Solver`](https://github.com/Theyka/Turnstile-Solver)
uses **patchright** (a patched Playwright): it loads the widget on a page and
reads `[name=cf-turnstile-response]` after the challenge passes. There is no
crypto to break — the "attack" is browser automation, and the outcome is a
genuine single-use token.

## 6. Assessment

- **Crypto-RE: n/a** — there is no client-side key/signature to reverse; the
  challenge VM is Cloudflare's proprietary, obfuscated code, and the token is
  server-validated.
- **Resistance: ~70 (client)** — the client cannot be minted; the only
  client-side lever is driving a real browser, which still yields a genuine
  token. The decision (and the `cf_clearance`/pre-clearance, if enabled) is
  entirely server-side.
- Good-vs-bad framing: a **good** design — client is a shuttle, proof is
  server-issued and single-use.

## Scope note

Public test sitekeys only; no production token handling; findings stated
honestly, never overstated.
