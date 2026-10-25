/** A tiny WebM (EBML) writer, enough for the stub clip. No dates, no random values: the same input gives the same bytes. */

const idBytes = (id: number): number[] => {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return out;
};

const sizeBytes = (size: number): number[] => {
  // Eight-byte size: a marker byte and seven bytes of length. Simple and always valid.
  const out = [0x01, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 7, v = size; i >= 1; i--, v = Math.floor(v / 256)) out[i] = v % 256;
  return out;
};

export const element = (id: number, payload: readonly number[]): number[] => [...idBytes(id), ...sizeBytes(payload.length), ...payload];
export const text = (value: string): number[] => [...new TextEncoder().encode(value)];
export const uint = (value: number): number[] => {
  const out: number[] = [];
  for (let v = value; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return out.length > 0 ? out : [0];
};
