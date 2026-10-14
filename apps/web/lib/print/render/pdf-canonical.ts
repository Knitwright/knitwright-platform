/**
 * The PDF library finishes its compressed streams as they complete, so two builds of one file can number and order the same
 * objects differently (an image's mask may be object 29 one time and 30 the next). This writes the objects again in the order
 * they are first reached from the document's root, numbered in that order, with the cross-reference table rebuilt. Nothing
 * inside an object changes except the numbers it points at. A file that does not look as expected is returned as it came.
 */

const latin = (bytes: Uint8Array, from: number, to: number): string => Buffer.from(bytes.subarray(from, to)).toString("latin1");

interface RawObject {
  readonly number: number;
  /** The text between "obj" and "stream" (or "endobj"). */
  readonly dict: string;
  /** The stream's bytes, or null. */
  readonly data: Uint8Array | null;
}

function parse(bytes: Uint8Array, from: number): { objects: Map<number, RawObject>; after: number } | null {
  const objects = new Map<number, RawObject>();
  let at = from;
  for (;;) {
    const head = /^(\d+) 0 obj\r?\n/.exec(latin(bytes, at, Math.min(bytes.length, at + 24)));
    if (head === null) return objects.size === 0 ? null : { objects, after: at };
    const bodyStart = at + head[0].length;
    const probe = latin(bytes, bodyStart, Math.min(bytes.length, bodyStart + 8192));
    const stream = /stream\r?\n/.exec(probe);
    const plainEnd = probe.indexOf("endobj");
    if (stream !== null && (plainEnd < 0 || stream.index < plainEnd)) {
      const dict = probe.slice(0, stream.index);
      const length = /\/Length (\d+)(?! \d+ R)/.exec(dict);
      if (length === null) return null;
      const dataStart = bodyStart + stream.index + stream[0].length;
      const dataEnd = dataStart + Number(length[1]);
      const close = latin(bytes, dataEnd, Math.min(bytes.length, dataEnd + 64));
      const tail = /^\r?\nendstream\r?\nendobj\r?\n?/.exec(close);
      if (tail === null) return null;
      objects.set(Number(head[1]), { number: Number(head[1]), dict, data: bytes.subarray(dataStart, dataEnd) });
      at = dataEnd + tail[0].length;
    } else {
      if (plainEnd < 0) return null;
      objects.set(Number(head[1]), { number: Number(head[1]), dict: probe.slice(0, plainEnd), data: null });
      at = bodyStart + plainEnd + "endobj".length;
      while (bytes[at] === 0x0a || bytes[at] === 0x0d) at += 1;
    }
  }
}

const REF = /(\d+) 0 R/g;

export function canonicalPdf(bytes: Uint8Array): Uint8Array {
  const headerEnd = latin(bytes, 0, 64).search(/\d+ 0 obj/);
  if (headerEnd < 0) return bytes;
  const parsed = parse(bytes, headerEnd);
  if (parsed === null) return bytes;
  const trailer = /trailer\r?\n(<<[\s\S]*?>>)\r?\nstartxref/.exec(latin(bytes, parsed.after, bytes.length));
  if (trailer === null) return bytes;
  const roots = [...trailer[1].matchAll(REF)].map((m) => Number(m[1]));
  if (roots.length === 0) return bytes;

  const order: number[] = [];
  const newNumber = new Map<number, number>();
  const visit = (n: number): boolean => {
    if (newNumber.has(n)) return true;
    const object = parsed.objects.get(n);
    if (object === undefined) return false;
    newNumber.set(n, order.length + 1);
    order.push(n);
    return [...object.dict.matchAll(REF)].every((m) => visit(Number(m[1])));
  };
  if (!roots.every(visit)) return bytes;

  const renumber = (text: string): string => text.replace(REF, (_all, n: string) => `${newNumber.get(Number(n))} 0 R`);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [bytes.subarray(0, headerEnd)];
  const offsets: number[] = [];
  let size = headerEnd;
  const push = (part: Uint8Array): void => {
    parts.push(part);
    size += part.length;
  };
  order.forEach((n, index) => {
    const object = parsed.objects.get(n)!;
    offsets.push(size);
    push(Buffer.from(`${index + 1} 0 obj\n${renumber(object.dict)}`, "latin1"));
    if (object.data === null) push(encoder.encode("endobj\n"));
    else {
      push(encoder.encode("stream\n"));
      push(object.data);
      push(encoder.encode("\nendstream\nendobj\n"));
    }
  });
  const table = `xref\n0 ${order.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  const dict = renumber(trailer[1]).replace(/\/Size \d+/, `/Size ${order.length + 1}`);
  const startxref = size;
  push(encoder.encode(`${table}trailer\n${dict}\nstartxref\n${startxref}\n%%EOF`));
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
