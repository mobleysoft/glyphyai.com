// index.js
// Deterministic procedural SVG generation, honestly labeled as non-AI (2026-09-12
// depth audit: replaced a hollow stub that returned the same canned
// {"generated":true} response for every input, including an empty body).
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.AUTHFOR_SERVICE) {
      console.log("Protected by AuthFor");
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
