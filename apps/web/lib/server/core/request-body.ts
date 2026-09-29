import { MESSAGES, type Failure } from "./errors";
import { invalidInput } from "./guard";

/**
 * Reading what a request carries, with a limit that holds even when the request does
 * not say how large it is, or lies about it.
 */

export type BodyRead =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; failure: Failure }>;

const TOO_LARGE: BodyRead = {
  ok: false,
  failure: { code: "too_large", message: MESSAGES.too_large },
};

const invalid = (part: string, message: string): BodyRead => ({
  ok: false,
  failure: invalidInput({ [part]: [message] }),
});

/**
 * Reads the body piece by piece and gives up as soon as it passes the limit, so an
 * oversized body is never held in memory whole. Returns null when it is over the limit.
 */
const readBytesUpTo = async (request: Request, maxBytes: number): Promise<Buffer | null> => {
  // The declared length lets an oversized body be refused before any of it is read.
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null;
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const pieces: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    pieces.push(value);
  }

  return Buffer.concat(pieces);
};

export const readJson = async (request: Request, maxBytes: number): Promise<BodyRead> => {
  const bytes = await readBytesUpTo(request, maxBytes);
  if (!bytes) return TOO_LARGE;
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return invalid("body", "The request body is not valid JSON.");
  }
};

/** Collects a form's fields. A field sent more than once becomes a list. */
const fieldsOf = (form: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> =>
  Object.fromEntries(
    [...new Set(form.keys())].map((name) => {
      const values = form.getAll(name);
      return [name, values.length > 1 ? values : values[0]];
    }),
  );

export const readForm = async (request: Request, maxBytes: number): Promise<BodyRead> => {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) {
    return invalid("form", "Send this as a form with a file.");
  }

  const bytes = await readBytesUpTo(request, maxBytes);
  if (!bytes) return TOO_LARGE;
  try {
    // The bytes are parsed by the platform's own form reader, not by hand.
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": type },
    }).formData();
    return { ok: true, value: fieldsOf(form) };
  } catch {
    return invalid("form", "The form could not be read.");
  }
};
