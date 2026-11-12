/** Joins class names, dropping the empty ones. */
export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string =>
  parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
