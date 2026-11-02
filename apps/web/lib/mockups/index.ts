/**
 * The mockup studio, deterministic and live-linked (plans/platform-v5.md wave 4, L2; spec F-L1's
 * free part; decision 0092).
 *
 * What is exported here is what a browser may carry: the scenes, their filters, the board's own
 * settings and every word a screen shows. What is **not** exported is everything that draws a
 * picture or reads the database -- `compose.ts`, `paint.ts`, `garment.ts`, `charts.ts` (sharp),
 * `schemas.ts` (zod), `seed.ts` and `service.ts` -- which are imported by their own path from the
 * server, exactly as the launch shell keeps its own schemas and reads out of `lib/launch/index.ts`.
 */
export * from "./assets";
export * from "./backdrops";
export * from "./board";
export * from "./copy";
export * from "./crops";
export * from "./gaps";
export * from "./library";
export * from "./scenes";
export * from "./types";
export * from "./views";
