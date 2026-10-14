import type { AssetColourSpace } from "@/lib/artwork-stack/assets";

/** What an embedded ICC profile says about itself. Read from the header and the description tag only. */
export type ProfileFacts = Readonly<{ name: string | null; space: "rgb" | "cmyk" | "grey" | "other" }>;

const HEADER_BYTES = 128;
const TAG_ENTRY_BYTES = 12;
const MAX_TAGS = 200;

const ascii = (bytes: Uint8Array, at: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const clean = (text: string): string | null => {
  // Control characters and the end-of-string marker are dropped; the name is shown as text.
  const name = [...text].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join("").trim();
  return name.length > 0 ? name.slice(0, 120) : null;
};

/** The legacy `desc` type: a length, then ASCII. */
const readDesc = (view: DataView, bytes: Uint8Array, at: number): string | null => {
  const length = view.getUint32(at + 8);
  return length > 0 && at + 12 + length <= bytes.length ? clean(ascii(bytes, at + 12, length)) : null;
};

/** The v4 `mluc` type: records of UTF-16 text. The first record is used. */
const readMluc = (view: DataView, bytes: Uint8Array, at: number): string | null => {
  const count = view.getUint32(at + 8);
  if (count < 1 || at + 28 > bytes.length) return null;
  const length = view.getUint32(at + 20);
  const offset = view.getUint32(at + 24);
  const start = at + offset;
  if (start + length > bytes.length) return null;
  let text = "";
  for (let i = 0; i + 1 < length; i += 2) text += String.fromCharCode(view.getUint16(start + i));
  return clean(text);
};

const SPACES: Readonly<Record<string, ProfileFacts["space"]>> = { "RGB ": "rgb", CMYK: "cmyk", GRAY: "grey" };

export function readProfile(icc: Uint8Array | undefined): ProfileFacts | null {
  if (!icc || icc.length < HEADER_BYTES + 4) return null;
  const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  if (ascii(icc, 36, 4) !== "acsp") return null;
  const space = SPACES[ascii(icc, 16, 4)] ?? "other";
  const tags = Math.min(view.getUint32(HEADER_BYTES), MAX_TAGS);
  for (let i = 0; i < tags; i += 1) {
    const entry = HEADER_BYTES + 4 + i * TAG_ENTRY_BYTES;
    if (entry + TAG_ENTRY_BYTES > icc.length) break;
    if (ascii(icc, entry, 4) !== "desc") continue;
    const at = view.getUint32(entry + 4);
    if (at + 12 > icc.length) break;
    const type = ascii(icc, at, 4);
    const name = type === "desc" ? readDesc(view, icc, at) : type === "mluc" ? readMluc(view, icc, at) : null;
    return { name, space };
  }
  return { name: null, space };
}

/** Where the picture's colour came from, named for the record and the messages. */
export function colourSpaceOf(profile: ProfileFacts | null, sharpSpace: string | undefined): AssetColourSpace {
  if (profile?.space === "cmyk" || sharpSpace === "cmyk") return "cmyk";
  if (profile?.space === "grey" || sharpSpace === "b-w" || sharpSpace === "grey16") return "grey";
  if (!profile) return "unknown";
  const name = (profile.name ?? "").toLowerCase();
  if (/adobe\s*rgb/.test(name)) return "adobe-rgb";
  if (/display\s*p3|p3/.test(name)) return "display-p3";
  return "srgb";
}
