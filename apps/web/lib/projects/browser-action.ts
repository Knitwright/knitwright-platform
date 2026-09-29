import { z } from "zod";
import { specActionSchema } from "@/lib/garment";

/**
 * What a browser may ask for. A browser cannot say where a value came from: whatever
 * source it claims is thrown away, and the server writes `user-edited` in its place, on
 * the value itself and inside fabrics, colourways and artwork. Only the server's own
 * trusted writers (a chart, the assistant, reading a picture) may name another source,
 * and they use `specActionSchema` directly.
 */

const USER = "user-edited";

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A copy with every `provenance` key removed, at any depth. */
const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (!isPlain(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "provenance")
      .map(([key, inner]) => [key, strip(inner)]),
  );
};

const stamped = (value: unknown): unknown => (isPlain(value) ? { ...value, provenance: USER } : value);

const stampColourway = (value: unknown): unknown => {
  if (!isPlain(value) || !Array.isArray(value.colours)) return value;
  return { ...value, colours: value.colours.map(stamped) };
};

/** Removes every source a browser claimed and stamps `user-edited` where one belongs. */
export const stampUserEdited = (raw: unknown): unknown => {
  const action = strip(raw);
  if (!isPlain(action)) return action;
  switch (action.type) {
    case "set-option":
    case "set-measurement":
      return stamped(action);
    case "add-fabric":
    case "update-fabric":
      return { ...action, fabric: stamped(action.fabric) };
    case "add-artwork":
    case "update-artwork":
      return { ...action, artwork: stamped(action.artwork) };
    case "add-colourway":
    case "update-colourway":
      return { ...action, colourway: stampColourway(action.colourway) };
    default:
      return action;
  }
};

export const browserActionSchema = z.preprocess(stampUserEdited, specActionSchema);
