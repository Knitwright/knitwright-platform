import type { ArticleDefinition } from "../article";
import type { DraftConstantValues } from "../constants";
import { len, line, mir, notch, offsetOutline, outline, rev, type Pt, type Segment } from "../geometry";
import { trimLoops } from "../loops";
import type { DraftPiece, NotchMark } from "../types";
import type { BodyCurves, SizeMeasures } from "./curves";
import type { Hem } from "./drop-tail";

type Allowances = ArticleDefinition["seam_allowance"];
type Notches = DraftConstantValues["notches"];

/** Seam names shared by the two pieces each seam joins. */
export const SEAM = {
  neck: "neckline",
  shoulder: "shoulder-seam",
  armhole: "armhole",
  side: "side-seam",
  bodyHem: "body-hem",
  underarm: "underarm-seam",
  sleeveHem: "sleeve-hem",
  ribJoin: "rib-join",
  cuffJoin: "cuff-join",
} as const;

type PieceSpec = Readonly<{
  id: string;
  label: string;
  cut: number;
  mirroredPair: boolean;
  fabricCode: string;
  segs: readonly Segment[];
  notches: readonly NotchMark[];
  landmarks: Readonly<Record<string, Pt>>;
}>;

/** Sew line from the segments, cut line by offsetting each edge by its allowance. */
export function assemble(spec: PieceSpec): DraftPiece {
  const o = outline(spec.segs);
  const allowances = new Map<string, number>();
  for (const seg of spec.segs) if (!allowances.has(seg.seamId)) allowances.set(seg.seamId, seg.sa);
  return {
    id: spec.id,
    label: spec.label,
    cut: spec.cut,
    mirroredPair: spec.mirroredPair,
    fabricCode: spec.fabricCode,
    sewLine: o.points,
    cutLine: trimLoops(offsetOutline(o.points, o.allow)),
    notches: spec.notches,
    seamAllowance: [...allowances].map(([seamId, mm]) => ({ seamId, mm })),
    landmarks: spec.landmarks,
  };
}

const mark = (seamId: string, slit: [Pt, Pt]): NotchMark => ({ seamId, slit });

/** Front or back: the same outline with its own neck and armhole curves and its own hem. */
function bodySegments(neck: Pt[], arm: Pt[], c: BodyCurves, m: SizeMeasures, sa: Allowances, hem: Hem): Segment[] {
  const { cx, sx, hx } = c;
  return [
    { pts: rev(neck), sa: sa.neck, seamId: SEAM.neck },
    { pts: line([hx, 0], [sx, m.slope]), sa: sa.shoulder, seamId: SEAM.shoulder },
    { pts: arm, sa: sa.armhole, seamId: SEAM.armhole },
    { pts: line([cx, m.G], [cx, m.B]), sa: sa.side, seamId: SEAM.side },
    { pts: hem.pts, sa: sa.body_hem, seamId: SEAM.bodyHem },
    { pts: line([-cx, m.B], [-cx, m.G]), sa: sa.side, seamId: SEAM.side },
    { pts: rev(mir(arm)), sa: sa.armhole, seamId: SEAM.armhole },
    { pts: line([-sx, m.slope], [-hx, 0]), sa: sa.shoulder, seamId: SEAM.shoulder },
    { pts: mir(neck), sa: sa.neck, seamId: SEAM.neck },
  ];
}

/** Centre neck and centre hem notches, then one armhole notch per side on the front, two on the back. */
function bodyNotches(neck: Pt[], arm: Pt[], sa: Allowances, k: Notches, hem: Hem, back: boolean): NotchMark[] {
  const armLen = len(arm);
  const slit = k.cut.slit_mm;
  const from = back ? k.armhole.back_from_underarm_mm : k.armhole.front_from_underarm_mm;
  return [
    mark(SEAM.neck, notch(rev(neck), k.cut.curve_start_epsilon_mm, sa.neck, slit)),
    mark(SEAM.bodyHem, notch(hem.pts, hem.centreDistance, sa.body_hem, slit)),
    ...from.map((d) => mark(SEAM.armhole, notch(arm, armLen - d, sa.armhole, slit))),
    ...from.map((d) => mark(SEAM.armhole, notch(rev(mir(arm)), d, sa.armhole, slit))),
  ];
}

export function bodyPiece(c: BodyCurves, m: SizeMeasures, article: ArticleDefinition, k: Notches, hem: Hem, back: boolean): DraftPiece {
  const sa = article.seam_allowance;
  const neck = back ? c.bNeck : c.fNeck;
  const arm = back ? c.bArm : c.fArm;
  const centreNeck = back ? "cb-neck" : "cf-neck";
  const centreHem = back ? "cb-hem" : "cf-hem";
  return assemble({
    id: back ? "back" : "front",
    label: back ? "BACK" : "FRONT",
    cut: 1,
    mirroredPair: false,
    fabricCode: article.fabrics.body.code,
    segs: bodySegments(neck, arm, c, m, sa, hem),
    notches: bodyNotches(neck, arm, sa, k, hem, back),
    landmarks: {
      hps: [c.hx, 0],
      "shoulder-point": [c.sx, m.slope],
      underarm: [c.cx, m.G],
      [centreNeck]: neck[neck.length - 1],
      [centreHem]: hem.centre,
      "side-hem": [c.cx, m.B],
    },
  });
}

/** Where the sleeve ends and what the edge is joined to: K01's own hem, or the K02 cuff seam. */
export type SleeveEdge = Readonly<{ y: number; halfWidth: number; seamId: string; sa: number }>;

/** The sleeve: cap from the solve, straight underarm seams to its edge, then its finish. */
export function sleevePiece(cap: Pt[], capH: number, m: SizeMeasures, article: ArticleDefinition, k: Notches, edge: SleeveEdge): DraftPiece {
  const sa = article.seam_allowance;
  const capLen = len(cap);
  const slit = k.cut.slit_mm;
  const [front] = k.armhole.front_from_underarm_mm;
  return assemble({
    id: "sleeve",
    label: "SLEEVE",
    cut: 2,
    mirroredPair: true,
    fabricCode: article.fabrics.body.code,
    segs: [
      { pts: rev(cap), sa: sa.armhole, seamId: SEAM.armhole },
      { pts: line([m.E, capH], [edge.halfWidth, edge.y]), sa: sa.sleeve_underarm, seamId: SEAM.underarm },
      { pts: line([edge.halfWidth, edge.y], [-edge.halfWidth, edge.y]), sa: edge.sa, seamId: edge.seamId },
      { pts: line([-edge.halfWidth, edge.y], [-m.E, capH]), sa: sa.sleeve_underarm, seamId: SEAM.underarm },
      { pts: mir(cap), sa: sa.armhole, seamId: SEAM.armhole },
    ],
    notches: [
      mark(SEAM.armhole, notch(rev(cap), k.cut.curve_start_epsilon_mm, sa.armhole, slit)),
      mark(SEAM.armhole, notch(rev(cap), capLen - front, sa.armhole, slit)),
      ...k.armhole.back_from_underarm_mm.map((d) => mark(SEAM.armhole, notch(mir(cap), d, sa.armhole, slit))),
    ],
    landmarks: { "cap-top": [0, 0], "hem-a": [edge.halfWidth, edge.y], "hem-b": [-edge.halfWidth, edge.y] },
  });
}

type Rectangle = Readonly<{
  id: string;
  label: string;
  cut: number;
  length: number;
  finishedDepth: number;
  /** The seam the long edges are joined on, and the seam that closes the loop. */
  joinSeamId: string;
  endSeamId: string;
  notchFractions: readonly number[];
}>;

/** A rib cut as a folded rectangle: the finished depth twice over, with its allowance all round. */
function ribRectangle(r: Rectangle, article: ArticleDefinition, k: Notches): DraftPiece {
  const sa = article.seam_allowance.rib;
  const width = 2 * r.finishedDepth;
  const edge = line([0, 0], [r.length, 0]);
  return assemble({
    id: r.id,
    label: r.label,
    cut: r.cut,
    mirroredPair: false,
    fabricCode: article.fabrics.rib.code,
    segs: [
      { pts: edge, sa, seamId: r.joinSeamId },
      { pts: line([r.length, 0], [r.length, width]), sa, seamId: r.endSeamId },
      { pts: line([r.length, width], [0, width]), sa, seamId: r.joinSeamId },
      { pts: line([0, width], [0, 0]), sa, seamId: r.endSeamId },
    ],
    notches: r.notchFractions.map((q) => mark(r.joinSeamId, notch(edge, r.length * q, sa, k.cut.slit_mm))),
    landmarks: {},
  });
}

/** The C01 neck rib: a rectangle the rib length long and twice the finished height, quartered. */
export function ribPiece(ribLen: number, m: SizeMeasures, article: ArticleDefinition, k: Notches): DraftPiece {
  return ribRectangle(
    {
      id: "neck-rib",
      label: "NECK RIB C01",
      cut: 1,
      length: ribLen,
      finishedDepth: m.L,
      joinSeamId: SEAM.neck,
      endSeamId: SEAM.ribJoin,
      notchFractions: k.neck_rib.fractions,
    },
    article,
    k,
  );
}

/**
 * The K02 cuff (owner decision 8): a folded rectangle, the sleeve opening less the rib's negative
 * ease long and twice the finished cuff depth deep, one per sleeve. The rulebook's notch rule
 * (R-PAT-006) quarters the neck rib and says nothing of a cuff, so the cuff carries no notch.
 */
export function cuffPiece(cutLength: number, finishedDepth: number, article: ArticleDefinition, k: Notches): DraftPiece {
  return ribRectangle(
    {
      id: "sleeve-cuff",
      label: "CUFF K02",
      cut: 2,
      length: cutLength,
      finishedDepth,
      joinSeamId: SEAM.cuffJoin,
      endSeamId: SEAM.ribJoin,
      notchFractions: [],
    },
    article,
    k,
  );
}
