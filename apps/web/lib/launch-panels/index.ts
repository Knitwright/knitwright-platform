/**
 * The public face of the four rail panels no workstream owned (plan v5, decision 0106).
 *
 * **Only the zod-free half is here on purpose.** A client panel imports this barrel for its words
 * and its view shapes; the three reads (`templates.ts`, `uploads.ts`, `brand.ts`) are imported by
 * their own route handlers, because they reach zod, `lib/garment` and `lib/catalogue` and
 * `tests/architecture/client-weight.test.ts` refuses to let a client component pull any of that
 * into the browser.
 */

export * from "./view";
export * from "./words";
