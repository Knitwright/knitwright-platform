/** A file name made of letters, digits, hyphen and underscore, so it is safe in any header. */
export function manifestFileName(orderName: string, extension: "csv" | "pdf"): string {
  const base = orderName.normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `${base === "" ? "team-order" : base}.${extension}`;
}
