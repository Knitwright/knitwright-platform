const TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 of some bytes, without depending on Buffer or btoa. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += TABLE[(n >> 18) & 63] + TABLE[(n >> 12) & 63] + (b === undefined ? "=" : TABLE[(n >> 6) & 63]) + (c === undefined ? "=" : TABLE[n & 63]);
  }
  return out;
}
