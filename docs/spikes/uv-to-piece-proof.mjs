// Throwaway proof for W6. Not production code. Run: node docs/spikes/uv-to-piece-proof.mjs
// Reads the benchmark jersey DXF, takes each piece's cut outline (layer 1 polyline), and shows
// that a point on a 3D surface that carries (pieceId, u, v) can be turned into piece mm and back,
// and that a zone given in piece mm lands inside the piece. Plain geometry, no libraries.
import { readFileSync } from "node:fs";
const dxf = new URL("../owner/reference/fashioninsta-2026-10-14/pattern_1598.dxf", import.meta.url);
const lines = readFileSync(dxf, "utf8").split(/\r?\n/);
const pieces = [];
let cur = null, inPoly = false, v = null;
for (let i = 0; i + 1 < lines.length; i += 2) {
  const code = lines[i].trim(), val = lines[i + 1].trim();
  if (code === "0" && val === "BLOCK") { cur = { name: "", outline: [] }; pieces.push(cur); inPoly = false; }
  else if (code === "2" && cur && !cur.name) cur.name = val;
  else if (code === "0" && val === "POLYLINE") { inPoly = true; cur.layer = null; cur.pts = []; }
  else if (inPoly && code === "8" && cur.layer === null) cur.layer = val;
  else if (code === "0" && val === "VERTEX") v = {};
  else if (v && code === "10") v.x = +val;
  else if (v && code === "20") { v.y = +val; if (cur.layer === "1" && cur.pts) cur.pts.push(v); v = null; }
  else if (code === "0" && val === "SEQEND" && cur?.layer === "1" && cur.pts.length) { cur.outline = cur.pts; inPoly = false; cur.layer = null; }
}
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
  const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const bounds = (o) => ({ minX: Math.min(...o.map(p => p.x)), maxX: Math.max(...o.map(p => p.x)), minY: Math.min(...o.map(p => p.y)), maxY: Math.max(...o.map(p => p.y)) });
// The mapping a 3D vertex would carry: piece id plus (u,v) in 0..1 of the piece bounds.
const toMm = (b, u, v) => ({ x: b.minX + u * (b.maxX - b.minX), y: b.minY + v * (b.maxY - b.minY) });
const toUv = (b, p) => ({ u: (p.x - b.minX) / (b.maxX - b.minX), v: (p.y - b.minY) / (b.maxY - b.minY) });
for (const p of pieces.filter(p => p.outline.length)) {
  const b = bounds(p.outline), w = b.maxX - b.minX, h = b.maxY - b.minY;
  const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const rt = toMm(b, ...Object.values(toUv(b, c)));
  const err = Math.hypot(rt.x - c.x, rt.y - c.y);
  console.log(`${p.name}: ${p.outline.length} pts, ${w.toFixed(1)} x ${h.toFixed(1)} mm, centre inside=${inside(c, p.outline)}, round-trip error=${err.toExponential(1)} mm`);
}
