/**
 * The launch shell and its boards (plans/platform-v5.md wave 4, L1, decision 0091).
 *
 * `panels.ts` is the contract L2 to L6 code against. Nothing that reads the database is exported
 * here: `service.ts` and `server.ts` are server-only, and `schemas.ts` carries zod, which the
 * architecture test keeps out of the browser.
 */
export * from "./address";
export * from "./artboard";
export * from "./assets";
export * from "./boards";
export * from "./costs";
export * from "./dock";
export * from "./graph";
export * from "./menu";
export * from "./page-state";
export * from "./panels";
export * from "./rail";
export * from "./task-bar";
export * from "./types";
export * from "./undo";
