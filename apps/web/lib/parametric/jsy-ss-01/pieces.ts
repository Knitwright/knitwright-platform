import type { ArticleDefinition } from "../article";
import { len, line, mir, notch, offsetOutline, outline, rev, type Pt, type Segment } from "../geometry";
import { trimLoops } from "../loops";
import type { DraftPiece, NotchMark } from "../types";
import type { BodyCurves, SizeMeasures } from "./curves";

type Allowances = ArticleDefinition["seam_allowance"];

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

/** Front or back: the same outline with its own neck and armhole curves. */
function bodySegments(neck: Pt[], arm: Pt[], c: BodyCurves, m: SizeMeasures, sa: Allowances): Segment[] {
  const { cx, sx, hx } = c;
  return [
    { pts: rev(neck), sa: sa.neck, seamId: SEAM.neck },
    { pts: line([hx, 0], [sx, m.slope]), sa: sa.shoulder, seamId: SEAM.shoulder },
    { pts: arm, sa: sa.armhole, seamId: SEAM.armhole },
    { pts: line([cx, m.G], [cx, m.B]), sa: sa.side, seamId: SEAM.side },
    { pts: line([cx, m.B], [-cx, m.B]), sa: sa.body_hem, seamId: SEAM.bodyHem },
    { pts: line([-cx, m.B], [-cx, m.G]), sa: sa.side, seamId: SEAM.side },
    { pts: rev(mir(arm)), sa: sa.armhole, seamId: SEAM.armhole },
    { pts: line([-sx, m.slope], [-hx, 0]), sa: sa.shoulder, seamId: SEAM.shoulder },
    { pts: mir(neck), sa: sa.neck, seamId: SEAM.neck },
  ];
}

/** Centre neck and centre hem notches, then one armhole notch per side on the front, two on the back. */
function bodyNotches(neck: Pt[], arm: Pt[], c: BodyCurves, m: SizeMeasures, sa: Allowances, back: boolean): NotchMark[] {
  const armLen = len(arm);
  const centre = [
    mark(SEAM.neck, notch(rev(neck), 0.01, sa.neck)),
    mark(SEAM.bodyHem, notch(line([c.cx, m.B], [-c.cx, m.B]), c.cx, sa.body_hem)),
  ];
  if (!back) {
    return [...centre, mark(SEAM.armhole, notch(arm, armLen - 75, sa.armhole)), mark(SEAM.armhole, notch(rev(mir(arm)), 75, sa.armhole))];
  }
  return [
    ...centre,
    mark(SEAM.armhole, notch(arm, armLen - 85, sa.armhole)),
    mark(SEAM.armhole, notch(arm, armLen - 95, sa.armhole)),
    mark(SEAM.armhole, notch(rev(mir(arm)), 85, sa.armhole)),
    mark(SEAM.armhole, notch(rev(mir(arm)), 95, sa.armhole)),
  ];
}

export function bodyPiece(c: BodyCurves, m: SizeMeasures, article: ArticleDefinition, back: boolean): DraftPiece {
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
    segs: bodySegments(neck, arm, c, m, sa),
    notches: bodyNotches(neck, arm, c, m, sa, back),
    landmarks: {
      hps: [c.hx, 0],
      "shoulder-point": [c.sx, m.slope],
      underarm: [c.cx, m.G],
      [centreNeck]: neck[neck.length - 1],
      [centreHem]: [0, m.B],
      "side-hem": [c.cx, m.B],
    },
  });
}

/** The sleeve: cap from the solve, straight underarm seams to the opening, K01 hem. */
export function sleevePiece(cap: Pt[], capH: number, m: SizeMeasures, article: ArticleDefinition): DraftPiece {
  const sa = article.seam_allowance;
  const capLen = len(cap);
  return assemble({
    id: "sleeve",
    label: "SLEEVE",
    cut: 2,
    mirroredPair: true,
    fabricCode: article.fabrics.body.code,
    segs: [
      { pts: rev(cap), sa: sa.armhole, seamId: SEAM.armhole },
      { pts: line([m.E, capH], [m.F, m.D]), sa: sa.sleeve_underarm, seamId: SEAM.underarm },
      { pts: line([m.F, m.D], [-m.F, m.D]), sa: sa.sleeve_hem, seamId: SEAM.sleeveHem },
      { pts: line([-m.F, m.D], [-m.E, capH]), sa: sa.sleeve_underarm, seamId: SEAM.underarm },
      { pts: mir(cap), sa: sa.armhole, seamId: SEAM.armhole },
    ],
    notches: [
      mark(SEAM.armhole, notch(rev(cap), 0.01, sa.armhole)),
      mark(SEAM.armhole, notch(rev(cap), capLen - 75, sa.armhole)),
      mark(SEAM.armhole, notch(mir(cap), 85, sa.armhole)),
      mark(SEAM.armhole, notch(mir(cap), 95, sa.armhole)),
    ],
    landmarks: { "cap-top": [0, 0] },
  });
}

/** The C01 neck rib: a rectangle the rib length long and twice the finished height, quartered. */
export function ribPiece(ribLen: number, m: SizeMeasures, article: ArticleDefinition): DraftPiece {
  const sa = article.seam_allowance.rib;
  const ribW = 2 * m.L;
  const edge = line([0, 0], [ribLen, 0]);
  return assemble({
    id: "neck-rib",
    label: "NECK RIB C01",
    cut: 1,
    mirroredPair: false,
    fabricCode: article.fabrics.rib.code,
    segs: [
      { pts: edge, sa, seamId: SEAM.neck },
      { pts: line([ribLen, 0], [ribLen, ribW]), sa, seamId: SEAM.ribJoin },
      { pts: line([ribLen, ribW], [0, ribW]), sa, seamId: SEAM.neck },
      { pts: line([0, ribW], [0, 0]), sa, seamId: SEAM.ribJoin },
    ],
    notches: [0.25, 0.5, 0.75].map((q) => mark(SEAM.neck, notch(edge, ribLen * q, sa))),
    landmarks: {},
  });
}
