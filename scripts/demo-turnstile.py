#!/usr/bin/env python3
"""demo-turnstile.py — print the Turnstile flow dissection from the PUBLIC test
sitekeys (docs.cloudflare.com): always-pass -> dummy token, force-interactive
-> challenge withheld. No forging — token is server-side, single-use."""
import json

def load(p):
    try: return json.load(open(p))
    except Exception: return {}

pas = load('/tmp/opencode/turnstile/cap-pass/result.json')
itx = load('/tmp/opencode/turnstile/cap-interactive/result.json')

print('=' * 74)
print('CLOUDFLARE TURNSTILE — client flow dissection (public test sitekeys)')
print('=' * 74)
print("\n[1] LOADER")
print("  GET challenges.cloudflare.com/turnstile/v0/api.js  -> 302 -> /turnstile/v0/b/<build>/api.js")
print("  (the api.js URL must be used verbatim; proxying/caching breaks it)")

print("\n[2] WIDGET renders in an IFRAME served from the SAME-ORIGIN path")
print("  /cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/<rand>/<sitekey>/auto/fbE/new/normal")
print("  -> the real work (non-interactive JS challenges: proof-of-work,")
print("     proof-of-space, Web-API probing, browser-quirk + human-behaviour")
print("     heuristics) runs INSIDE that iframe; results come back via postMessage.")

print("\n[3] OUTCOME per key (public test keys)\n")
print("  sitekey 1x00000000000000000000AA  (always pass)")
print(f"      token = {json.dumps(pas.get('state',{}).get('token'))}")
print("  sitekey 3x00000000000000000000FF  (force interactive)")
print(f"      token = {json.dumps(itx.get('state',{}).get('token'))}   calls={json.dumps(itx.get('state',{}).get('calls'))}")
print("      -> before-interactive fired, NO token issued headless (challenge wall)")

print("\n[4] THE TOKEN")
print("  On pass the client gets cf-turnstile-response (e.g. 'XXXX.DUMMY.TOKEN.XXXX'")
print("  for the test key). It is:")
print("    - single use  (replay -> 'timeout-or-duplicate')")
print("    - 300 s TTL")
print("    - validated SERVER-SIDE at /turnstile/v0/siteverify with the secret key")
print("  => the client CANNOT mint or forge a token; the secret never ships.")

print("\n[5] HOW IT IS ACTUALLY BYPASSED (no token forge)")
print("  A patched real browser solves the challenge legitimately -- e.g. the")
print("  public Theyka/Turnstile-Solver (patchright) loads the widget and reads")
print("  [name=cf-turnstile-response]. Bypass = driving a real browser, not crypto.")

print()
print('=' * 74)
print('RESULT: read flow 🟢 | mint/forge token 🔴 (server-side, single-use)')
print('crypto-RE: n/a (no forgeable client crypto — proprietary challenge VM)')
print('resistance: ~70 — client cannot be minted; a patched real browser can solve.')
print('=' * 74)
