/**
 * Test fixture: a baseline CMYK TIFF written by hand, so a test can have real CMYK pixels with or without an
 * embedded ICC profile and a stated resolution. The image library cannot make one from raw channels.
 */
type CmykTiffOptions = Readonly<{
  width: number;
  height: number;
  /** Ink amounts per pixel, 0 to 255, c m y k. */
  pixel: readonly [number, number, number, number];
  icc?: Uint8Array;
  dpi?: number;
}>;

const ENTRY = 12;

export function cmykTiff(options: CmykTiffOptions): Uint8Array {
  const { width, height, pixel, icc, dpi } = options;
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set(pixel, i * 4);
  const entries = 11 + (dpi ? 3 : 0) + (icc ? 1 : 0);
  const ifdStart = 8;
  let blob = ifdStart + 2 + entries * ENTRY + 4;
  const place = (size: number) => {
    const at = blob;
    blob += size + (size % 2);
    return at;
  };
  const bitsAt = place(8);
  const xAt = dpi ? place(8) : 0;
  const yAt = dpi ? place(8) : 0;
  const stripAt = place(pixels.length);
  const iccAt = icc ? place(icc.length) : 0;
  const out = new Uint8Array(blob);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdStart, true);
  view.setUint16(ifdStart, entries, true);
  let cursor = ifdStart + 2;
  const put = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(cursor, tag, true);
    view.setUint16(cursor + 2, type, true);
    view.setUint32(cursor + 4, count, true);
    if (type === 3 && count === 1) view.setUint16(cursor + 8, value, true);
    else view.setUint32(cursor + 8, value, true);
    cursor += ENTRY;
  };
  const SHORT = 3;
  const LONG = 4;
  const RATIONAL = 5;
  put(256, LONG, 1, width);
  put(257, LONG, 1, height);
  put(258, SHORT, 4, bitsAt);
  put(259, SHORT, 1, 1);
  put(262, SHORT, 1, 5);
  put(273, LONG, 1, stripAt);
  put(277, SHORT, 1, 4);
  put(278, LONG, 1, height);
  put(279, LONG, 1, pixels.length);
  if (dpi) {
    put(282, RATIONAL, 1, xAt);
    put(283, RATIONAL, 1, yAt);
  }
  put(284, SHORT, 1, 1);
  if (dpi) put(296, SHORT, 1, 2);
  put(332, SHORT, 1, 1);
  if (icc) put(34675, 7, icc.length, iccAt);
  for (let i = 0; i < 4; i += 1) view.setUint16(bitsAt + i * 2, 8, true);
  if (dpi) {
    view.setUint32(xAt, dpi, true);
    view.setUint32(xAt + 4, 1, true);
    view.setUint32(yAt, dpi, true);
    view.setUint32(yAt + 4, 1, true);
  }
  out.set(pixels, stripAt);
  if (icc) out.set(icc, iccAt);
  return out;
}
