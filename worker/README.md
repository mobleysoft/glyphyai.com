# glyphyai-com-worker

Source of the Cloudflare Worker deployed as `glyphyai-com-worker` on the
`johnmobley99` account (`glyphyai-com-worker.johnmobley99.workers.dev`).
Deployed directly via the Workers API (module upload), not `wrangler`, so
this file is committed here to keep the deployed artifact and its source
in sync -- it was previously undocumented in git entirely.

**Not** the same thing as the zone root route for `glyphyai.com/*`, which
currently points at `mobley-venture-fleet-a` (the shared venture-brief
worker, which serves a real waitlist form backed by shared D1). This
worker is only reachable at its `workers.dev` subdomain right now, and is
where `ventures.json`'s `worker_url` field for this venture points.

Preserves a real Cloudflare service binding, `AUTHFOR_SERVICE` ->
`authfor-com-worker` (present before this change, not added by it).

## 2026-09-12 depth audit fix

The only route this script ever served, `POST
/api/glyphyai/vector-synthesis`, returned an identical hardcoded
`{"status":"success","generated":true,...}` for every request regardless
of body content (empty, garbage, or a real brief all produced the exact
same response) -- a live, real 200 response, but a fabricated one: nothing
was actually generated. Replaced with a real deterministic procedural SVG
generator: the request's `brief` text is hashed to seed a real choice of
shape, brand-palette color, and monogram, producing an actual, distinct,
valid SVG per input. Labeled honestly as "deterministic, non-AI" rather
than continuing to imply generative-AI output. Also added real input
validation (400 on missing `brief`, 405 on non-POST) where none existed
before.
