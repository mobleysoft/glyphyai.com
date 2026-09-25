// Real, deterministic regression check for worker/index.js's procedural SVG
// generator. Run by concatenating worker/index.js's source with this file's
// source and executing the result as a single ES module (so it can
// reference synthesize/PALETTE/SHAPES directly as module-scope bindings,
// without needing to add test-only exports to the deployed Worker file):
//
//   node --input-type=module --check < worker/index.js && \
//     { cat worker/index.js; cat verify_synthesize.mjs; } | node --input-type=module -
//
// Added 2026-09-25 alongside the PALETTE/SHAPES expansion (6x5 -> 12x10x2)
// -- this venture had no test suite before this pass.

const briefs = [
  "orbital finance",
  "quiet forest studio",
  "acme rockets",
  "acme rocket",
  "zen garden cafe",
  "neon drift labs",
  "blue harbor works",
  "blue harbor work",
  "crimson anvil forge",
  "pale lantern press",
];

let ok = true;
const seen = new Set();

for (const b of briefs) {
  const r1 = synthesize(b);
  const r2 = synthesize(b);
  if (r1.svg !== r2.svg) {
    console.error("FAIL: non-deterministic output for brief:", b);
    ok = false;
  }
  if (!/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(r1.svg) || !r1.svg.includes("<text")) {
    console.error("FAIL: malformed SVG for brief:", b, r1.svg);
    ok = false;
  }
  seen.add([r1.colorIdx, r1.shapeIdx, r1.filled].join("|"));
}

if (PALETTE.length !== 12) {
  console.error("FAIL: PALETTE.length expected 12, got", PALETTE.length);
  ok = false;
}
if (SHAPES.length !== 10) {
  console.error("FAIL: SHAPES.length expected 10, got", SHAPES.length);
  ok = false;
}
// Not every brief needs a unique combination, but the whole point of this
// change is that 10 genuinely different-looking test briefs shouldn't
// mostly collide -- allow a couple of coincidental collisions, not most of them.
if (seen.size < briefs.length - 2) {
  console.error(`FAIL: too many visual collisions among ${briefs.length} distinct test briefs: only ${seen.size} unique (color,shape,fill) combos`);
  ok = false;
}

console.log(ok ? `PASS: ${seen.size}/${briefs.length} unique combos, deterministic, valid SVG` : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
