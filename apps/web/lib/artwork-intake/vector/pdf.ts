import { ARTWORK_LIMITS } from "../limits";
import type { Budget } from "./budget";
import { IDENTITY, apply, meanScale, multiply, type Matrix } from "./matrix";
import { VECTOR_MODEL_VERSION, type VectorDoc, type VectorNode, type VectorStroke, vectorDocSchema } from "./model";
import type { PathCmd } from "./path-data";
import { refuse, REFUSALS } from "./refuse";
import { TEXT_OMITTED } from "./svg";

/**
 * Reads the first page of a PDF (or of an Illustrator file saved with PDF compatibility) into the
 * restricted vector model. Only the drawing instructions are read: no script, action, attached file or
 * form is ever run or kept. Simple vector content (paths, solid colours, strokes, clips) becomes the model.
 * Pictures, shadings and patterns cannot be rasterised here (see decision 0036), so they are refused with
 * a sentence that says what to do instead.
 */

const LIMITS = ARTWORK_LIMITS.vector;

export const SCRIPTS_DROPPED = "This PDF contained scripts or actions. They were ignored and are not kept.";
export const ATTACHMENTS_DROPPED = "This PDF carried attached files. They were ignored and are not kept.";
export const FIRST_PAGE_ONLY = "This PDF has more than one page. Only the first was used.";
export const SPOT_COLOURS = "Spot colours were turned into screen colours.";
export const TRANSPARENCY_FLATTENED = "Some transparency effects in this PDF were not kept.";

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loaded: Promise<Pdfjs> | null = null;
const pdfjs = (): Promise<Pdfjs> => (loaded ??= import("pdfjs-dist/legacy/build/pdf.mjs"));

type GState = Readonly<{
  ctm: Matrix;
  fill: string;
  stroke: string;
  fillAlpha: number;
  strokeAlpha: number;
  width: number;
  cap: VectorStroke["cap"];
  join: VectorStroke["join"];
  miter: number;
  dash: number[] | undefined;
  depth: number;
}>;

const START: GState = { ctm: IDENTITY, fill: "#000000", stroke: "#000000", fillAlpha: 1, strokeAlpha: 1, width: 1, cap: "butt", join: "miter", miter: 10, dash: undefined, depth: 0 };

const CAPS = ["butt", "round", "square"] as const;
const JOINS = ["miter", "round", "bevel"] as const;
const round = (v: number): number => Math.round(v * 1000) / 1000 + 0;

type Painted = Readonly<{ fill: "nonzero" | "evenodd" | null; stroke: boolean; close: boolean; clipOnly: boolean }>;

/** What each painting operator of a path does. */
function paintOf(ops: Record<string, number>, code: number): Painted | null {
  const table: Record<number, Painted> = {
    [ops.fill]: { fill: "nonzero", stroke: false, close: false, clipOnly: false },
    [ops.eoFill]: { fill: "evenodd", stroke: false, close: false, clipOnly: false },
    [ops.stroke]: { fill: null, stroke: true, close: false, clipOnly: false },
    [ops.closeStroke]: { fill: null, stroke: true, close: true, clipOnly: false },
    [ops.fillStroke]: { fill: "nonzero", stroke: true, close: false, clipOnly: false },
    [ops.eoFillStroke]: { fill: "evenodd", stroke: true, close: false, clipOnly: false },
    [ops.closeFillStroke]: { fill: "nonzero", stroke: true, close: true, clipOnly: false },
    [ops.closeEOFillStroke]: { fill: "evenodd", stroke: true, close: true, clipOnly: false },
    [ops.endPath]: { fill: null, stroke: false, close: false, clipOnly: true },
  };
  return table[code] ?? null;
}

/** The path instructions of one `constructPath`: 0 move, 1 line, 2 curve, 3 quadratic curve, 4 close. */
function pathOf(data: ArrayLike<number>, ctm: Matrix): PathCmd[] {
  const out: PathCmd[] = [];
  const point = (x: number, y: number): [number, number] => {
    const [px, py] = apply(ctm, x, y);
    return [round(px), round(py)];
  };
  let at = 0;
  let current: [number, number] = [0, 0];
  while (at < data.length) {
    const code = data[at];
    at += 1;
    if (code === 0 || code === 1) {
      current = point(data[at], data[at + 1]);
      out.push([code === 0 ? "M" : "L", ...current]);
      at += 2;
    } else if (code === 2) {
      const [a, b, c] = [point(data[at], data[at + 1]), point(data[at + 2], data[at + 3]), point(data[at + 4], data[at + 5])];
      out.push(["C", ...a, ...b, ...c]);
      current = c;
      at += 6;
    } else if (code === 3) {
      const [q, end] = [point(data[at], data[at + 1]), point(data[at + 2], data[at + 3])];
      out.push(["C", round(current[0] + (2 / 3) * (q[0] - current[0])), round(current[1] + (2 / 3) * (q[1] - current[1])), round(end[0] + (2 / 3) * (q[0] - end[0])), round(end[1] + (2 / 3) * (q[1] - end[1])), ...end]);
      current = end;
      at += 4;
    } else {
      out.push(["Z"]);
    }
  }
  return out;
}

type Walk = {
  state: GState;
  readonly saved: GState[];
  /** Open groups, outermost first. Each clip opens one; a restore closes the ones opened since its save. */
  readonly open: { clip: string | undefined; nodes: VectorNode[] }[];
  readonly clips: { id: string; nodes: VectorNode[] }[];
  pendingClip: "nonzero" | "evenodd" | null;
  textOmitted: boolean;
  needsPixels: boolean;
  transparency: boolean;
  drawn: number;
};

function closeTo(walk: Walk, depth: number): void {
  while (walk.open.length - 1 > depth) {
    const group = walk.open.pop() as { clip: string | undefined; nodes: VectorNode[] };
    if (group.nodes.length > 0) walk.open[walk.open.length - 1].nodes.push({ t: "g", opacity: 1, ...(group.clip ? { clip: group.clip } : {}), children: group.nodes });
  }
}

function emit(walk: Walk, cmds: PathCmd[], paint: Painted): void {
  const { state } = walk;
  const closed = paint.close && cmds.at(-1)?.[0] !== "Z" ? [...cmds, ["Z"] as PathCmd] : cmds;
  const width = round(state.width * meanScale(state.ctm));
  const stroke: VectorStroke | null = paint.stroke
    ? {
        paint: { kind: "colour", hex: state.stroke },
        width: width > 0 ? width : 0.001,
        opacity: state.strokeAlpha,
        cap: state.cap,
        join: state.join,
        miterLimit: Math.max(1, state.miter),
        ...(state.dash ? { dash: state.dash.map((d) => round(d * meanScale(state.ctm))) } : {}),
      }
    : null;
  const fillRule = paint.fill ?? "nonzero";
  walk.drawn += 1;
  walk.open[walk.open.length - 1].nodes.push({
    t: "path",
    opacity: 1,
    cmds: closed,
    fill: paint.fill ? { kind: "colour", hex: state.fill } : null,
    fillOpacity: state.fillAlpha,
    fillRule,
    stroke,
  });
}

function openClip(walk: Walk, cmds: PathCmd[], rule: "nonzero" | "evenodd"): void {
  const id = `c${walk.clips.length + 1}`;
  walk.clips.push({ id, nodes: [{ t: "path", opacity: 1, cmds, fill: { kind: "colour", hex: "#000000" }, fillOpacity: 1, fillRule: rule, stroke: null }] });
  walk.open.push({ clip: id, nodes: [] });
}

type Step = (walk: Walk, args: readonly unknown[], budget: Budget) => void;

function handlers(ops: Record<string, number>): Map<number, Step> {
  const map = new Map<number, Step>();
  const on = (name: string, step: Step): void => void map.set(ops[name], step);
  const set = (patch: (walk: Walk, args: readonly unknown[]) => Partial<GState>): Step => (walk, args) => void (walk.state = { ...walk.state, ...patch(walk, args) });
  const save: Step = (walk) => {
    walk.saved.push({ ...walk.state, depth: walk.open.length - 1 });
  };
  const restore: Step = (walk) => {
    const back = walk.saved.pop();
    if (!back) return;
    closeTo(walk, back.depth);
    walk.state = back;
  };
  const concat: Step = (walk, args) => void (walk.state = { ...walk.state, ctm: multiply(walk.state.ctm, args as unknown as Matrix) });

  on("save", save);
  on("restore", restore);
  on("transform", concat);
  on("paintFormXObjectBegin", (walk, args) => {
    save(walk, args, null as never);
    // The matrix arrives as a typed array.
    if (args[0] && typeof args[0] === "object") concat(walk, Array.from(args[0] as ArrayLike<number>), null as never);
  });
  on("paintFormXObjectEnd", restore);
  on("setLineWidth", set((_, a) => ({ width: Number(a[0]) })));
  on("setLineCap", set((_, a) => ({ cap: CAPS[Number(a[0])] ?? "butt" })));
  on("setLineJoin", set((_, a) => ({ join: JOINS[Number(a[0])] ?? "miter" })));
  on("setMiterLimit", set((_, a) => ({ miter: Number(a[0]) })));
  on("setDash", set((_, a) => ({ dash: Array.isArray(a[0]) && a[0].length > 0 && a[0].some((v: number) => v > 0) ? a[0].slice(0, 16).map(Number) : undefined })));
  on("setFillRGBColor", set((_, a) => ({ fill: String(a[0]) })));
  on("setStrokeRGBColor", set((_, a) => ({ stroke: String(a[0]) })));
  for (const name of ["setFillColorN", "setStrokeColorN"]) {
    on(name, (walk, args) => {
      const colour = typeof args[0] === "string" && /^#[0-9a-f]{6}$/i.test(args[0]) ? args[0].toLowerCase() : null;
      if (colour === null) walk.needsPixels = true;
      else walk.state = { ...walk.state, [name === "setFillColorN" ? "fill" : "stroke"]: colour };
    });
  }
  on("setGState", (walk, args) => {
    for (const pair of (Array.isArray(args[0]) ? args[0] : []) as [string, unknown][]) {
      const [key, value] = pair;
      const patch: Partial<GState> | null =
        key === "CA" ? { strokeAlpha: Math.max(0, Math.min(1, Number(value))) }
        : key === "ca" ? { fillAlpha: Math.max(0, Math.min(1, Number(value))) }
        : key === "LW" ? { width: Number(value) }
        : key === "LC" ? { cap: CAPS[Number(value)] ?? "butt" }
        : key === "LJ" ? { join: JOINS[Number(value)] ?? "miter" }
        : key === "ML" ? { miter: Number(value) }
        : null;
      if (patch) walk.state = { ...walk.state, ...patch };
      else if ((key === "SMask" && value !== "None" && value !== null) || (key === "BM" && value !== "Normal" && value !== "Compatible" && value !== null)) walk.transparency = true;
    }
  });
  on("constructPath", (walk, args, budget) => {
    const [code, groups] = args as [number, ArrayLike<number>[]];
    const flat = groups[0] ?? [];
    budget.pathCommands(Math.ceil(flat.length / 3));
    const painted = paintOf(ops, code);
    const cmds = pathOf(flat, walk.state.ctm);
    if (painted && !painted.clipOnly && cmds.some((c) => c[0] === "L" || c[0] === "C")) emit(walk, cmds, painted);
    if (walk.pendingClip && cmds.length > 0) openClip(walk, cmds, walk.pendingClip);
    walk.pendingClip = null;
  });
  // The clip operator comes before the path it clips with, so it only marks the rule for the path that follows.
  on("clip", (walk) => void (walk.pendingClip = "nonzero"));
  on("eoClip", (walk) => void (walk.pendingClip = "evenodd"));
  for (const name of ["showText", "showSpacedText", "nextLineShowText", "nextLineSetSpacingShowText", "beginText"]) on(name, (walk) => void (walk.textOmitted = true));
  for (const name of [
    "shadingFill", "paintImageXObject", "paintInlineImageXObject", "paintImageMaskXObject", "paintImageMaskXObjectGroup", "paintInlineImageXObjectGroup",
    "paintImageXObjectRepeat", "paintImageMaskXObjectRepeat", "paintSolidColorImageMask", "beginInlineImage",
  ]) on(name, (walk) => void (walk.needsPixels = true));
  return map;
}

function newWalk(viewport: Matrix): Walk {
  return {
    state: { ...START, ctm: viewport },
    saved: [],
    open: [{ clip: undefined, nodes: [] }],
    clips: [],
    pendingClip: null,
    textOmitted: false,
    needsPixels: false,
    transparency: false,
    drawn: 0,
  };
}

const withTimeout = <T>(work: Promise<T>, onTimeout: () => void): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error("timeout"));
    }, LIMITS.maxParseMs * 2);
    work.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error)),
    );
  });

const sizeOf = (found: unknown): number =>
  found instanceof Map ? found.size : found && typeof found === "object" ? Object.keys(found).length : 0;

/** Whether the raw bytes name a script action. Compressed object streams hide some, so the reader's own answer counts too. */
const mentionsScripts = (bytes: Uint8Array): boolean => /\/(?:JavaScript|JS)\b/.test(new TextDecoder("latin1").decode(bytes));

/** Spot colour spaces are named in the file; the drawing instructions only carry their screen colours. */
const mentionsSpotColours = (bytes: Uint8Array): boolean => /\/(?:Separation|DeviceN)\b/.test(new TextDecoder("latin1").decode(bytes));

export async function pdfToVector(bytes: Uint8Array, budget: Budget): Promise<VectorDoc> {
  if (bytes.byteLength > LIMITS.maxPdfBytes) refuse(REFUSALS.tooBig(LIMITS.maxPdfBytes / 1024));
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    enableXfa: false,
    disableFontFace: true,
    verbosity: 0,
    // A picture inside the PDF is never decoded here.
    maxImageSize: 1,
    stopAtErrors: true,
  });
  const warnings = new Set<string>();
  try {
    const doc = await withTimeout(task.promise, () => void task.destroy());
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    if (doc.numPages > 1) warnings.add(FIRST_PAGE_ONLY);
    const list = await withTimeout(page.getOperatorList({ annotationMode: lib.AnnotationMode.DISABLE }), () => void task.destroy());
    const [actions, attachments] = await Promise.all([doc.getJSActions().catch(() => null), doc.getAttachments().catch(() => null)]);
    if (mentionsScripts(bytes) || sizeOf(actions) > 0) warnings.add(SCRIPTS_DROPPED);
    if (sizeOf(attachments) > 0) warnings.add(ATTACHMENTS_DROPPED);

    const steps = handlers(lib.OPS as unknown as Record<string, number>);
    const walk = newWalk(viewport.transform as unknown as Matrix);
    list.fnArray.forEach((code: number, i: number) => {
      budget.tick();
      steps.get(code)?.(walk, (list.argsArray[i] ?? []) as readonly unknown[], budget);
    });
    if (walk.needsPixels) return refuse(REFUSALS.pdfNeedsPixels);
    closeTo(walk, 0);
    if (walk.textOmitted) warnings.add(TEXT_OMITTED);
    if (walk.transparency) warnings.add(TRANSPARENCY_FLATTENED);
    if (walk.drawn === 0) return refuse(walk.textOmitted ? `${REFUSALS.empty} ${TEXT_OMITTED}` : REFUSALS.empty);
    if (mentionsSpotColours(bytes)) warnings.add(SPOT_COLOURS);
    const doc2 = vectorDocSchema.safeParse({
      schemaVersion: VECTOR_MODEL_VERSION,
      kind: "vector",
      source: "pdf",
      viewBox: { x: 0, y: 0, width: round(viewport.width), height: round(viewport.height) },
      naturalWidthMm: round((viewport.width * 25.4) / 72),
      gradients: [],
      clips: walk.clips,
      nodes: walk.open[0].nodes,
      textOmitted: walk.textOmitted,
      warnings: [...warnings].slice(0, 20),
    });
    return doc2.success ? doc2.data : refuse(REFUSALS.tooComplex);
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    if (error instanceof Error && error.name === "PasswordException") return refuse(REFUSALS.passwordPdf);
    if (error instanceof Error && error.message === "timeout") return refuse(REFUSALS.tooSlow);
    return refuse(REFUSALS.notPdf);
  } finally {
    void task.destroy();
  }
}
