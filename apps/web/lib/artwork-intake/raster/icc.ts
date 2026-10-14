import type { AssetColourSpace } from "@/lib/artwork-stack";

const TAG_TABLE_AT = 128;
const TAG_SIZE = 12;
const MAX_PROFILE_BYTES = 8 * 1024 * 1024;

const ascii = (view: DataView, at: number, length: number): string =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(at + i)));

const clean = (text: string): string => text.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 120);

/** The text of a `desc` (version 2) or `mluc` (version 4) description tag. */
const readDescription = (view: DataView, at: number, size: number): string => {
  if (at + 12 > view.byteLength) return "";
  const type = ascii(view, at, 4);
  if (type === "desc") {
    const length = view.getUint32(at + 8);
    return at + 12 + length <= view.byteLength ? clean(ascii(view, at + 12, Math.min(length, size))) : "";
  }
  if (type === "mluc" && view.getUint32(at + 8) >= 1) {
    const length = view.getUint32(at + 20);
    const offset = view.getUint32(at + 24);
    if (at + offset + length > view.byteLength) return "";
    const units = Array.from({ length: length / 2 }, (_, i) => view.getUint16(at + offset + i * 2));
    return clean(String.fromCharCode(...units));
  }
  return "";
};

/** The name an ICC profile gives itself (for example "Adobe RGB (1998)"), or null when it has none we can read. */
export const iccProfileName = (profile: Uint8Array | undefined): string | null => {
  if (!profile || profile.byteLength < TAG_TABLE_AT + 4 || profile.byteLength > MAX_PROFILE_BYTES) return null;
  const view = new DataView(profile.buffer, profile.byteOffset, profile.byteLength);
  const count = Math.min(view.getUint32(TAG_TABLE_AT), 200);
  for (let i = 0; i < count; i += 1) {
    const entry = TAG_TABLE_AT + 4 + i * TAG_SIZE;
    if (entry + TAG_SIZE > view.byteLength) return null;
    if (ascii(view, entry, 4) === "desc") {
      const name = readDescription(view, view.getUint32(entry + 4), view.getUint32(entry + 8));
      return name === "" ? null : name;
    }
  }
  return null;
};

/** Where the colours came from, as the platform names it. The print copy is sRGB whatever this says. */
export const classifyColour = (space: string | undefined, profileName: string | null): AssetColourSpace => {
  if (space === "cmyk") return "cmyk";
  const name = (profileName ?? "").toLowerCase();
  if (name.includes("adobe rgb")) return "adobe-rgb";
  if (name.includes("p3")) return "display-p3";
  if (space === "b-w" || space === "grey16") return "grey";
  if (name.includes("gray") || name.includes("grey")) return "grey";
  if (profileName === null && (space === "srgb" || space === "rgb16")) return "srgb";
  return name.includes("srgb") ? "srgb" : "unknown";
};
