export type VideoType = "video/webm" | "video/mp4";

const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const FTYP = [0x66, 0x74, 0x79, 0x70];

const at = (bytes: Uint8Array, offset: number, pattern: readonly number[]): boolean => pattern.every((byte, i) => bytes[offset + i] === byte);

/** The type of a video from its first bytes. What a browser or a provider says the file is, is not trusted. */
export const sniffVideo = (bytes: Uint8Array): VideoType | null => {
  if (at(bytes, 0, EBML)) return "video/webm";
  if (at(bytes, 4, FTYP)) return "video/mp4";
  return null;
};
