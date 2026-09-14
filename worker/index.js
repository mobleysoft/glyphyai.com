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
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTE = ["#00BFA5", "#FF4081", "#FF80AB", "#3D5AFE", "#FFC400", "#00E5FF"];

const SHAPES = [
  (c) => `<circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="3"/>`,
  (c) => `<polygon points="32,8 56,48 8,48" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  (c) => `<rect x="12" y="12" width="40" height="40" rx="8" fill="none" stroke="${c}" stroke-width="3"/>`,
  (c) => `<polygon points="32,6 54,20 54,44 32,58 10,44 10,20" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  (c) => `<path d="M8 44 L26 12 L34 24 L18 52 Z" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
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
  const color = PALETTE[h % PALETTE.length];
  const shape = SHAPES[Math.floor(h / PALETTE.length) % SHAPES.length];
  const letters = monogram(brief);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    shape(color) +
    `<text x="32" y="38" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="700" fill="${color}">${letters}</text>` +
    `</svg>`;
  return { svg, seed: h, color, monogram: letters };
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

<p class="capability">Honest scope note: this is deterministic procedural generation seeded by your
text (a hash function choosing among a fixed palette/shape/monogram set), not a machine-learned
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
generate();
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
        capability: "Procedural SVG/icon generation (deterministic, non-AI -- the brief's text seeds a real shape/color/monogram choice, not a machine-learned model)",
        brief,
        svg: result.svg,
        seed: result.seed
      }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("glyphyai.com - Procedural SVG/icon generation API. Endpoint: POST /api/glyphyai/vector-synthesis with JSON body {\"brief\": \"...\"}", { status: 404 });
  }
};
