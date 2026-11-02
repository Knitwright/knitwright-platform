/**
 * The marketing studio (plans/platform-v5.md wave 4, L4; spec F-L2; decision 0094).
 *
 * What a panel may import. Nothing here reads the database and nothing here makes a file:
 * `service.ts` and `schemas.ts` carry zod, and `export/render.ts`, `export/pdf.ts` and
 * `export/zip.ts` carry sharp, the PDF writer and the zip -- none of which belongs in a page
 * (`tests/architecture/client-weight.test.ts`, decision 0011).
 */
export * from "./assets";
export * from "./board";
export * from "./elements";
export * from "./layers";
export * from "./layout";
export * from "./panels";
export * from "./replace";
export * from "./rules";
export * from "./selection";
export * from "./campaign/form";
export * from "./campaign/generate";
export * from "./campaign/steps";
export * from "./copy/voice";
export * from "./export/colour";
export * from "./export/panel";
export * from "./export/seeded";
export * from "./export/targets";
export * from "./templates/arrangements";
export * from "./templates/build";
export * from "./templates/plans";
export * from "./templates/types";
