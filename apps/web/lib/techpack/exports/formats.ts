import type { View } from "@/lib/flat/model";

/** The three files a tech pack can be downloaded as. */
export const EXPORT_FORMATS = ["pdf", "xlsx", "svg"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_VIEWS = ["front", "back"] as const satisfies readonly View[];

export const EXTENSIONS: Readonly<Record<ExportFormat, string>> = { pdf: "pdf", xlsx: "xlsx", svg: "svg" };
