const MAX_LABEL = 80;

/**
 * A plain name for a list, taken from the file name. The file name is never used as a path or an address: stored
 * files are named by the server. Folders, the extension, control characters and symbols are removed.
 */
export const labelFrom = (fileName: string): string => {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const withoutExtension = base.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const cleaned = withoutExtension
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._()'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+/, "");
  return (cleaned.slice(0, MAX_LABEL).trim() || "Artwork");
};
