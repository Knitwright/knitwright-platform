/**
 * AI scenes and shoots with the garment locked (plans/platform-v5.md wave 4, L3; spec F-L1's AI
 * part; decision 0093).
 *
 * What is exported here is what a browser may carry: the concepts, the poses, the model presets, the
 * board's own settings, the cost, the progress, the modal's rules and every word a screen shows.
 *
 * What is **not** exported is everything that calls a model, reads the database or touches a
 * picture's bytes -- `provider.ts`, `adapter.ts`, `stub.ts`, `run.ts`, `check.ts`, `schemas.ts`,
 * `seed.ts`, `service.ts`, `settings.ts` -- which are imported by their own path from the server,
 * exactly as the mockup studio keeps `compose.ts` and `sharp` out of `lib/mockups/index.ts`.
 */
export * from "./board";
export * from "./concepts";
export * from "./copy";
export * from "./cost";
export * from "./library";
export * from "./modal";
export * from "./models";
export * from "./poses";
export * from "./progress";
export * from "./types";
export * from "./verdict";
