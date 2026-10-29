import { createHash } from "node:crypto";
import { pdfDate } from "./writer";

/**
 * Pins a PDF made by another generator (the tech pack PDF from @react-pdf/renderer) to a fixed
 * time. The creation and modification dates in its information dictionary are rewritten to the
 * design version's creation time, and the file id, which that writer derives from the clock, is
 * rewritten from the pinned bytes. Every replacement keeps the length of what it replaces, so the
 * cross-reference offsets stay right. A PDF that holds neither is returned unchanged.
 */

const DATE = /\/(CreationDate|ModDate) ?\(D:[0-9]{14}(Z|[+-][0-9]{2}'?[0-9]{2}'?)?\)/g;
const ID = /\/ID ?\[ ?<([0-9a-fA-F]+)> ?<([0-9a-fA-F]+)> ?\]/g;

const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

function pinnedDate(match: string, pinned: string): string {
  const key = match.startsWith("/CreationDate") ? "/CreationDate" : "/ModDate";
  const spaced = match.charAt(key.length) === " " ? " " : "";
  const body = `${key}${spaced}(${pinned})`;
  // A date with a time zone is longer than ours: pad inside the dictionary with spaces after the string.
  return body.length <= match.length ? body.padEnd(match.length, " ") : match;
}

export function pinPdf(bytes: Uint8Array, createdIso: string): Uint8Array {
  const pinned = pdfDate(createdIso);
  const dated = latin1(bytes).replace(DATE, (match) => pinnedDate(match, pinned));
  const withoutId = dated.replace(ID, (match) => match.replace(/<[0-9a-fA-F]+>/g, (hex) => `<${"0".repeat(hex.length - 2)}>`));
  const hash = createHash("sha256").update(withoutId, "latin1").digest("hex").repeat(4);
  const out = withoutId.replace(ID, (match) => match.replace(/<0+>/g, (hex) => `<${hash.slice(0, hex.length - 2)}>`));
  return Uint8Array.from(Buffer.from(out, "latin1"));
}
