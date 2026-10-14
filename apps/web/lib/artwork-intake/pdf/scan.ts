/**
 * A first look at a PDF's bytes for the parts that can act: script, launching a program, opening an address,
 * submitting a form or carrying a file. PDF names can hide letters as #xx, so those are decoded first. A PDF can
 * also keep these inside compressed streams; the reader looks again at what it finds there (see rasterise.ts).
 */

export type PdfFindings = Readonly<{
  /** A script was found. The file is refused. */
  script: boolean;
  /** Embedded files, launch actions, address actions or form submission. These are left out, not kept. */
  dropped: readonly string[];
}>;

const SCRIPT_NAMES = ["javascript", "js", "rendition", "richmedia", "xfa", "sound", "movie"];
const DROPPED_NAMES: Readonly<Record<string, string>> = {
  embeddedfile: "embedded files",
  embeddedfiles: "embedded files",
  filespec: "embedded files",
  launch: "a command to open another program",
  uri: "web links",
  submitform: "a form that sends data",
  importdata: "a form that loads data",
  openaction: "an action that runs when the file opens",
  aa: "actions that run on events",
};

const decodeName = (name: string): string => name.replace(/#([0-9a-fA-F]{2})/g, (_whole, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))).toLowerCase();

/** Reads the PDF bytes as text for names only (Latin-1 keeps every byte). */
export const scanPdf = (bytes: Uint8Array): PdfFindings => {
  const text = new TextDecoder("latin1").decode(bytes);
  const names = new Set<string>();
  for (const match of text.matchAll(/\/([A-Za-z0-9#_.-]{1,40})/g)) names.add(decodeName(match[1]));
  const dropped = new Set<string>();
  for (const [name, sentence] of Object.entries(DROPPED_NAMES)) if (names.has(name)) dropped.add(sentence);
  return {
    script: SCRIPT_NAMES.some((name) => names.has(name)),
    dropped: [...dropped].sort(),
  };
};
