/** The panel's reading of what the variants route sends back. Plain checks (no zod, so the browser bundle stays small) and tested without a browser. */
export type TileKind = "colourway" | "kit-style" | "placement";
export interface TileFinding {
  readonly code: string;
  readonly severity: "blocker" | "warning";
  readonly panel: string | null;
  readonly message: string;
}
export interface TileView {
  readonly id: string;
  readonly kind: TileKind;
  readonly label: string;
  readonly summary: string;
  readonly src: string | null;
  readonly alt: string;
  readonly warnings: readonly TileFinding[];
}

export const UNREADABLE = "The alternatives could not be read. Try again.";

export type ListAnswer = Readonly<{ ok: true; version: number; tiles: readonly TileView[] }> | Readonly<{ ok: false; message: string }>;
type ApplyAnswer = Readonly<{ ok: true; version: number; created: boolean }> | Readonly<{ ok: false; message: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const KINDS: readonly unknown[] = ["colourway", "kit-style", "placement"];

const isFinding = (value: unknown): value is TileFinding =>
  isRecord(value) &&
  typeof value.code === "string" &&
  (value.severity === "blocker" || value.severity === "warning") &&
  (value.panel === null || typeof value.panel === "string") &&
  typeof value.message === "string";

const isTile = (value: unknown): value is TileView =>
  isRecord(value) &&
  typeof value.id === "string" &&
  KINDS.includes(value.kind) &&
  typeof value.label === "string" &&
  typeof value.summary === "string" &&
  (value.src === null || typeof value.src === "string") &&
  typeof value.alt === "string" &&
  Array.isArray(value.warnings) &&
  value.warnings.every(isFinding);

/** The server's own sentence for a refusal, or the plain one. */
function refusal(body: unknown): { ok: false; message: string } {
  const error = isRecord(body) && body.success === false && isRecord(body.error) ? body.error.message : undefined;
  return { ok: false, message: typeof error === "string" ? error : UNREADABLE };
}

export function parseList(body: unknown): ListAnswer {
  if (isRecord(body) && body.success === true && isRecord(body.data)) {
    const { version, tiles } = body.data;
    if (Number.isInteger(version) && Array.isArray(tiles) && tiles.every(isTile)) return { ok: true, version: version as number, tiles };
  }
  return refusal(body);
}

export function parseApplied(body: unknown): ApplyAnswer {
  if (isRecord(body) && body.success === true && isRecord(body.data)) {
    const { version, created } = body.data;
    if (Number.isInteger(version) && typeof created === "boolean") return { ok: true, version: version as number, created };
  }
  return refusal(body);
}

export const KIND_HEADINGS: Readonly<Record<TileKind, string>> = {
  colourway: "Colourways",
  "kit-style": "Kit styles",
  placement: "Placement",
};

/** The sentence under an applied variant. */
export const appliedSentence = (created: boolean, version: number): string =>
  created ? `Saved as version ${version}. Undo in History takes it back.` : `This design is already version ${version}; nothing new was saved.`;
