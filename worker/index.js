// index.js
// Deterministic procedural SVG generation, honestly labeled as non-AI (2026-09-12
// depth audit: replaced a hollow stub that returned the same canned
// {"generated":true} response for every input, including an empty body).
//
// 2026-09-12 (later same day): added a minimal, honest, real UI at GET
// /studio so a visitor can actually call the endpoint below and see the
// result -- plain HTML/CSS/vanilla JS, no framework, no CDN dependency.
// The API logic below is otherwise UNCHANGED. Served at /studio rather
// than "/" because "/" on glyphyai.com already belongs to the shared
// venture-fleet worker's real waitlist page (see worker/README.md) --
// this only adds routes that didn't exist before.
//
// 2026-09-14 (depth audit): the root domain's own marketing copy already
// promised "an actual downloadable SVG mark", but /studio only rendered
// the SVG inline with no way to save it -- a real overclaim on the live
// page. Fixed: /studio now offers a real "Download SVG" link (Blob +
// object URL, no server change) so the existing claim is literally true.
//
// 2026-09-21 (depth audit): found and fixed a real business-logic gap in
// the 2026-09-19 checkout work -- entitlement was checked by session_id
// alone (via vendyai's GET /api/checkout/sessions/{id}, which returns only
// {venture_id, status, amount_total, currency, created_at}, no metadata/
// brief). vector-synthesis-pack accepted an arbitrary client-supplied
// `brief` independent of what was actually purchased, so a single
// completed $39 session entitled the buyer to unlimited packs for ANY
// brief, forever -- not just the one they paid for. Since vendyai's API
// doesn't expose the original brief for the worker to check against, the
// fix is a signed pack_token (HMAC over `${session_id}:${brief}`, keyed by
// the same VENDYAI_WEBHOOK_SECRET already bound to this worker) minted
// only inside the real POST /api/glyphyai/checkout response (which itself
// requires a fresh, real vendyai session creation call each time) and
// required again at vector-synthesis-pack time alongside the existing
// live isEntitled() check. This ties each individual completed payment to
// exactly the one (session, brief) pair it was actually issued for --
// no new storage, no new secret, no client trust.
// 2026-09-19 (depth audit): the recorded next_step was monetization --
// spec_v2's "$39 one-time" pricing_hypothesis had no purchase path
// anywhere, so a visitor who liked a generated mark could only ever get
// it for free. Wired a real checkout through vendyai.com per the
// portfolio's "sell through vendyai" standing policy: POST
// /api/glyphyai/checkout creates a real, live Stripe Checkout Session
// (ad-hoc price_data, no pre-created Stripe product needed) for a "Full
// Pack" -- 3 additional deterministic variations of the same brief plus
// a commercial usage license -- distinct from the single free preview
// mark /studio already gives away. Entitlement after payment is checked
// live against vendyai's own GET /api/checkout/sessions/{id} (real,
// already-persisted Stripe status) rather than duplicating that state
// here, so no new D1/storage was needed in this worker. This venture
// (venture_id "glyphyai") registered with vendyai via a real POST
// /api/ventures/register call using a freshly generated HMAC secret
// (stored only as this Worker's own encrypted secret binding,
// VENDYAI_WEBHOOK_SECRET -- never committed to source). The registered
// webhook target (/api/glyphyai/vendyai-webhook below) verifies vendyai's
// real HMAC-SHA256/base64url signature scheme (matching
// hmacSha256Base64Url in vendyai.com/src/worker.js exactly) and just
// acknowledges receipt -- fulfillment doesn't depend on the webhook
// firing, since /api/glyphyai/vector-synthesis-pack re-checks the same
// live session-status endpoint server-side before releasing the pack.
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 2026-09-25 (depth audit): the 2026-09-24 pass's own honest finding was
// that a fixed 6-color x 5-shape palette (30 combinations, before the
// monogram/text) gives a "logo generator" audience too few visually
// distinct outcomes -- likely to be noticed on a Product Hunt launch.
// Expanded to 12 colors x 10 shapes x a filled/outline variant (240
// combinations) so two unrelated briefs are far less likely to land on
// the same visual mark. Still deterministic, still honestly labeled as
// procedural (not generative-AI) -- this widens the fixed set, it doesn't
// change what kind of generation this is.
const PALETTE = [
  "#00BFA5", "#FF4081", "#FF80AB", "#3D5AFE", "#FFC400", "#00E5FF",
  "#7C4DFF", "#FF6D00", "#64DD17", "#D500F9", "#F50057", "#6200EA",
];

function polygonShape(points) {
  return (c, filled) => filled
    ? `<polygon points="${points}" fill="${c}"/>`
    : `<polygon points="${points}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`;
}
function pathShape(d) {
  return (c, filled) => filled
    ? `<path d="${d}" fill="${c}"/>`
    : `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`;
}

const SHAPES = [
  (c, filled) => filled
    ? `<circle cx="32" cy="32" r="22" fill="${c}"/>`
    : `<circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="3"/>`,
  polygonShape("32,8 56,48 8,48"), // triangle
  (c, filled) => filled
    ? `<rect x="12" y="12" width="40" height="40" rx="8" fill="${c}"/>`
    : `<rect x="12" y="12" width="40" height="40" rx="8" fill="none" stroke="${c}" stroke-width="3"/>`,
  polygonShape("32,6 54,20 54,44 32,58 10,44 10,20"), // hexagon
  pathShape("M8 44 L26 12 L34 24 L18 52 Z"), // kite
  polygonShape("32,10 54,32 32,54 10,32"), // diamond
  polygonShape("32,8 54.8,24.6 46.1,51.4 17.9,51.4 9.2,24.6"), // pentagon
  polygonShape("24,10 40,10 40,24 54,24 54,40 40,40 40,54 24,54 24,40 10,40 10,24 24,24"), // plus
  polygonShape("32,8 37.9,23.9 54.8,24.6 41.5,35.1 46.1,51.4 32,42 17.9,51.4 22.5,35.1 9.2,24.6 26.1,23.9"), // 5-point star
  pathShape("M32 6 C42 20 48 30 48 40 A16 16 0 1 1 16 40 C16 30 22 20 32 6 Z"), // teardrop
];

function monogram(brief) {
  const words = brief.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "G";
  const first = words[0][0] || "G";
  const second = words.length > 1 ? (words[1][0] || "") : "";
  return (first + second).toUpperCase();
}

function synthesize(brief) {
  const h = hash32(brief.toLowerCase().trim());
  const colorIdx = h % PALETTE.length;
  const color = PALETTE[colorIdx];
  let rest = Math.floor(h / PALETTE.length);
  const shapeIdx = rest % SHAPES.length;
  const shape = SHAPES[shapeIdx];
  rest = Math.floor(rest / SHAPES.length);
  const filled = (rest % 2) === 1;
  const letters = monogram(brief);
  // Dark monogram on a filled/saturated shape, brand-color monogram on an
  // outline (matches the studio page's dark background) -- either way
  // stays legible across the whole palette rather than picking one text
  // color that only works for half the combinations.
  const textFill = filled ? "#0d0d12" : color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    shape(color, filled) +
    `<text x="32" y="38" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="700" fill="${textFill}">${letters}</text>` +
    `</svg>`;
  return { svg, seed: h, color, colorIdx, shapeIdx, filled, monogram: letters };
}

// Paid "Full Pack": 3 more deterministic marks for the same brief, seeded
// distinctly from the free preview so a paying customer gets real
// additional variety, not the same mark relabeled.
function synthesizePack(brief) {
  return ["::v2", "::v3", "::v4"].map((suffix) => synthesize(brief + suffix));
}

const VENDYAI_API_BASE = "https://vendyai.com";
const VENTURE_ID = "glyphyai";
const PACK_PRICE_USD_CENTS = 3900; // matches ventures.json spec_v2 pricing_hypothesis ($39 one-time)

async function hmacSha256Base64Url(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const binary = String.fromCharCode(...new Uint8Array(sig));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Matches vendyai.com/src/worker.js's forwardToVenture() signing scheme exactly:
// X-Webhook-Signature = base64url(HMAC-SHA256(`${timestamp}.${rawBody}`, secret)).
async function verifyVendyaiWebhookSignature(rawBody, timestamp, signature, secret) {
  if (!timestamp || !signature || !secret) return false;
  const expected = await hmacSha256Base64Url(`${timestamp}.${rawBody}`, secret);
  return expected === signature;
}

// Binds a completed payment to the exact brief it was issued for. vendyai's
// session-status endpoint doesn't expose the original metadata.brief, so
// this worker mints its own signed proof at checkout time instead of
// trusting a client-supplied brief at pack-generation time.
async function packToken(sessionId, brief, secret) {
  return hmacSha256Base64Url(`pack:${sessionId}:${brief}`, secret);
}

async function verifyPackToken(sessionId, brief, token, secret) {
  if (!token || !secret) return false;
  const expected = await packToken(sessionId, brief, secret);
  return expected === token;
}

// Live entitlement check -- asks vendyai's own already-persisted Stripe
// session status rather than trusting anything the client sends.
async function isEntitled(sessionId) {
  if (!sessionId) return false;
  try {
    const res = await fetch(`${VENDYAI_API_BASE}/api/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return false;
    const row = await res.json();
    return row.venture_id === VENTURE_ID && row.status === "completed";
  } catch (e) {
    return false;
  }
}

const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GlyphyAI Studio &mdash; Procedural Vector Synthesis</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background:#0d0d12; color:#eee; margin:0; padding:2rem; }
  h1 { font-size:1.4rem; margin-bottom:0.3rem; }
  .note { color:#9ecbff; font-size:0.85rem; max-width:640px; line-height:1.4; }
  .row { display:flex; gap:0.5rem; max-width:640px; margin-top:1rem; flex-wrap:wrap; }
  input[type=text] { flex:1; min-width:220px; padding:0.6rem; border-radius:6px; border:1px solid #33333e; background:#17171f; color:#eee; font-size:1rem; }
  button { padding:0.6rem 1.2rem; background:#3d5afe; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:1rem; }
  button:disabled { background:#33333e; cursor:default; }
  .result { margin-top:1.5rem; display:flex; gap:1.5rem; align-items:flex-start; flex-wrap:wrap; }
  .svg-box { background:#17171f; border:1px solid #33333e; border-radius:10px; padding:1.2rem; display:flex; align-items:center; justify-content:center; }
  .svg-box svg { width:96px; height:96px; }
  pre { background:#17171f; padding:1rem; border-radius:6px; max-width:400px; overflow:auto; font-size:0.8rem; }
  .err { color:#ff8080; margin-top:1rem; }
  .capability { color:#888; font-size:0.75rem; max-width:640px; margin-top:1.5rem; }
  .buy { margin-top:1rem; padding:1rem; background:#17171f; border:1px solid #33333e; border-radius:10px; max-width:640px; }
  .buy button { background:#00bfa5; color:#0b0b0f; }
  .pack { margin-top:1rem; display:flex; gap:1rem; flex-wrap:wrap; }
  .msg { color:#9ecbff; font-size:0.85rem; margin-top:0.5rem; }
</style>
</head>
<body>
<h1>GlyphyAI Studio &mdash; Procedural Vector Synthesis</h1>
<p class="note">Enter a short brief (e.g. "orbital finance" or "quiet forest studio"). This calls the
real, deployed <code>POST /api/glyphyai/vector-synthesis</code> endpoint, which deterministically
derives a shape, color, and monogram from your text and returns a real SVG &mdash; not a mockup,
not a canned response, not a generative AI model. Same brief always produces the same mark.</p>

<div class="row">
  <input type="text" id="brief" placeholder="Describe your brand or idea..." value="orbital finance">
  <button id="go">Generate</button>
</div>

<div id="out"></div>

<div class="buy">
  <strong>Full Pack &mdash; $39 one-time</strong>
  <p class="note">3 additional variations of this same brief, plus a commercial usage license.
  Real checkout via <a href="https://vendyai.com" style="color:#9ecbff">vendyai.com</a> (live Stripe Checkout,
  not a mockup) &mdash; you'll be redirected to a real payment page.</p>
  <button id="buy">Buy Full Pack</button>
  <div id="buyMsg"></div>
</div>
<div id="packOut" class="pack"></div>

<p class="capability">Honest scope note: this is deterministic procedural generation seeded by your
text (a hash function choosing among a fixed palette/shape/fill-treatment/monogram set), not a machine-learned
image model. It's a real, working first pass at a mark generator, not a claim of AI-designed
branding.</p>

<script>
async function generate() {
  const briefEl = document.getElementById('brief');
  const goBtn = document.getElementById('go');
  const out = document.getElementById('out');
  const brief = briefEl.value.trim();
  if (!brief) {
    out.innerHTML = '<p class="err">Enter a brief first.</p>';
    return;
  }
  goBtn.disabled = true;
  goBtn.textContent = 'Generating...';
  out.innerHTML = '';
  try {
    const res = await fetch('/api/glyphyai/vector-synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief })
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      out.innerHTML = '<p class="err">Error: ' + (data.message || res.status) + '</p>';
      return;
    }
    const blob = new Blob([data.svg], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    const filename = 'glyphyai-' + data.brief.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '.svg';
    out.innerHTML =
      '<div class="result">' +
        '<div class="svg-box">' + data.svg + '</div>' +
        '<div>' +
          '<pre>' + JSON.stringify({ brief: data.brief, seed: data.seed, capability: data.capability }, null, 2) + '</pre>' +
          '<a id="dl" download="' + filename + '" style="display:inline-block;margin-top:0.5rem;padding:0.5rem 1rem;background:#00bfa5;color:#0b0b0f;font-weight:700;border-radius:6px;text-decoration:none;">Download SVG</a>' +
        '</div>' +
      '</div>';
    document.getElementById('dl').href = blobUrl;
  } catch (e) {
    out.innerHTML = '<p class="err">Request failed: ' + e.message + '</p>';
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
  }
}
document.getElementById('go').addEventListener('click', generate);
document.getElementById('brief').addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });

async function buyPack() {
  const briefEl = document.getElementById('brief');
  const buyBtn = document.getElementById('buy');
  const buyMsg = document.getElementById('buyMsg');
  const brief = briefEl.value.trim();
  if (!brief) {
    buyMsg.innerHTML = '<p class="err">Enter a brief first.</p>';
    return;
  }
  buyBtn.disabled = true;
  buyBtn.textContent = 'Redirecting to checkout...';
  try {
    const res = await fetch('/api/glyphyai/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief })
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      buyMsg.innerHTML = '<p class="err">Error: ' + (data.message || res.status) + '</p>';
      buyBtn.disabled = false;
      buyBtn.textContent = 'Buy Full Pack';
      return;
    }
    try { localStorage.setItem('glyphyai_pt_' + data.session_id, data.pack_token); } catch (e) {}
    window.location.href = data.checkout_url;
  } catch (e) {
    buyMsg.innerHTML = '<p class="err">Request failed: ' + e.message + '</p>';
    buyBtn.disabled = false;
    buyBtn.textContent = 'Buy Full Pack';
  }
}
document.getElementById('buy').addEventListener('click', buyPack);

async function checkPurchase() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('purchased');
  const brief = params.get('brief');
  if (!sessionId) return;
  const buyMsg = document.getElementById('buyMsg');
  const packOut = document.getElementById('packOut');
  buyMsg.innerHTML = '<p class="msg">Checking your purchase...</p>';
  if (brief) document.getElementById('brief').value = brief;
  try {
    const entRes = await fetch('/api/glyphyai/entitlement?session_id=' + encodeURIComponent(sessionId));
    const ent = await entRes.json();
    if (!ent.entitled) {
      buyMsg.innerHTML = '<p class="msg">No completed payment found yet for this session. If you just paid, this can take a few seconds -- refresh to retry.</p>';
      return;
    }
    buyMsg.innerHTML = '<p class="msg">Payment confirmed. Loading your Full Pack...</p>';
    let packToken = '';
    try { packToken = localStorage.getItem('glyphyai_pt_' + sessionId) || ''; } catch (e) {}
    const packRes = await fetch('/api/glyphyai/vector-synthesis-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: brief || document.getElementById('brief').value.trim(), session_id: sessionId, pack_token: packToken })
    });
    const pack = await packRes.json();
    if (!packRes.ok || pack.status !== 'success') {
      buyMsg.innerHTML = '<p class="err">Error loading pack: ' + (pack.message || packRes.status) + '</p>';
      return;
    }
    buyMsg.innerHTML = '<p class="msg">Full Pack unlocked -- licensed for commercial use.</p>';
    packOut.innerHTML = pack.pack.map(function(item, i) {
      return '<div class="svg-box">' + item.svg + '</div>';
    }).join('');
  } catch (e) {
    buyMsg.innerHTML = '<p class="err">Could not verify purchase: ' + e.message + '</p>';
  }
}

generate();
checkPurchase();
</script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.AUTHFOR_SERVICE) {
      console.log("Protected by AuthFor");
    }
    if (url.pathname === "/studio" || url.pathname === "/studio/") {
      return new Response(UI_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/api/glyphyai/vector-synthesis") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ status: "error", message: "Use POST with a JSON body: {\"brief\": \"...\"}" }), {
          status: 405,
          headers: { "Content-Type": "application/json", "Allow": "POST" }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
      const brief = typeof body.brief === "string" ? body.brief.trim() : "";
      if (!brief) {
        return new Response(JSON.stringify({ status: "error", message: "Missing required field: brief (non-empty string)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const result = synthesize(brief);
      return new Response(JSON.stringify({
        status: "success",
        generated: true,
        capability: "Procedural SVG/icon generation (deterministic, non-AI -- the brief's text seeds a real shape/color/fill-treatment/monogram choice, not a machine-learned model)",
        brief,
        svg: result.svg,
        seed: result.seed
      }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/glyphyai/checkout") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ status: "error", message: "Use POST with a JSON body: {\"brief\": \"...\"}" }), {
          status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" }
        });
      }
      let body;
      try { body = await request.json(); } catch (e) { body = {}; }
      const brief = typeof body.brief === "string" ? body.brief.trim() : "";
      if (!brief) {
        return new Response(JSON.stringify({ status: "error", message: "Missing required field: brief (non-empty string)" }), {
          status: 400, headers: { "Content-Type": "application/json" }
        });
      }
      try {
        const res = await fetch(`${VENDYAI_API_BASE}/api/checkout/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venture_id: VENTURE_ID,
            mode: "payment",
            success_url: `${url.origin}/studio?purchased={CHECKOUT_SESSION_ID}&brief=${encodeURIComponent(brief)}`,
            cancel_url: `${url.origin}/studio?brief=${encodeURIComponent(brief)}`,
            line_items: [{
              price_data: {
                currency: "usd",
                unit_amount: PACK_PRICE_USD_CENTS,
                product_data: {
                  name: `GlyphyAI Full Pack -- "${brief}"`,
                  description: "3 additional procedural mark variations for this brief, plus a commercial usage license."
                }
              },
              quantity: 1
            }],
            metadata: { brief }
          })
        });
        const data = await res.json();
        if (!res.ok || !data.session) {
          return new Response(JSON.stringify({ status: "error", message: data.error?.message || "checkout session creation failed" }), {
            status: 502, headers: { "Content-Type": "application/json" }
          });
        }
        const token = await packToken(data.session.id, brief, env.VENDYAI_WEBHOOK_SECRET);
        return new Response(JSON.stringify({
          status: "success", checkout_url: data.session.url, session_id: data.session.id, pack_token: token
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ status: "error", message: e.message }), {
          status: 502, headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/api/glyphyai/entitlement" && request.method === "GET") {
      const sessionId = url.searchParams.get("session_id") || "";
      const entitled = await isEntitled(sessionId);
      return new Response(JSON.stringify({ status: "success", entitled }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/glyphyai/vector-synthesis-pack") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ status: "error", message: "Use POST with a JSON body: {\"brief\": \"...\", \"session_id\": \"...\"}" }), {
          status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" }
        });
      }
      let body;
      try { body = await request.json(); } catch (e) { body = {}; }
      const brief = typeof body.brief === "string" ? body.brief.trim() : "";
      const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
      const submittedToken = typeof body.pack_token === "string" ? body.pack_token.trim() : "";
      if (!brief) {
        return new Response(JSON.stringify({ status: "error", message: "Missing required field: brief (non-empty string)" }), {
          status: 400, headers: { "Content-Type": "application/json" }
        });
      }
      const tokenValid = await verifyPackToken(sessionId, brief, submittedToken, env.VENDYAI_WEBHOOK_SECRET);
      if (!tokenValid) {
        return new Response(JSON.stringify({ status: "error", message: "This session's purchase doesn't match the requested brief. Start a new checkout for this brief via POST /api/glyphyai/checkout." }), {
          status: 403, headers: { "Content-Type": "application/json" }
        });
      }
      const entitled = await isEntitled(sessionId);
      if (!entitled) {
        return new Response(JSON.stringify({ status: "error", message: "No completed purchase found for this session. See POST /api/glyphyai/checkout." }), {
          status: 402, headers: { "Content-Type": "application/json" }
        });
      }
      const pack = synthesizePack(brief).map((r) => ({ svg: r.svg, seed: r.seed }));
      return new Response(JSON.stringify({ status: "success", brief, license: "commercial", pack }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/glyphyai/vendyai-webhook" && request.method === "POST") {
      const raw = await request.text();
      const sig = request.headers.get("X-Webhook-Signature");
      const ts = request.headers.get("X-Webhook-Timestamp");
      const ok = await verifyVendyaiWebhookSignature(raw, ts, sig, env.VENDYAI_WEBHOOK_SECRET);
      if (!ok) {
        return new Response(JSON.stringify({ status: "error", message: "invalid signature" }), {
          status: 401, headers: { "Content-Type": "application/json" }
        });
      }
      // Fulfillment doesn't depend on this firing -- entitlement is
      // re-checked live via /api/glyphyai/entitlement at delivery time --
      // so this handler only needs to acknowledge a verified event.
      console.log("[glyphyai] verified vendyai webhook received:", raw.slice(0, 300));
      return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("glyphyai.com - Procedural SVG/icon generation API. Endpoint: POST /api/glyphyai/vector-synthesis with JSON body {\"brief\": \"...\"}", { status: 404 });
  }
};
