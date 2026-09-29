import type { SeamClass, StitchClass } from "../definitions";

/**
 * The kinds of stitch (ISO 4915) and of seam (ISO 4916) that garments in this registry use.
 * The numbers are names of kinds, which a factory reads. They are not quantities, and they
 * are the only numbers the registry may hold. Every explanation is a plain draft for a
 * factory to confirm. They were written from memory and not checked against ISO 4915 and ISO 4916. See OWNER-QUESTIONS.md.
 */
export const STITCH_CLASSES: readonly StitchClass[] = [
  {
    id: "lockstitch",
    iso: "301",
    name: "Lockstitch",
    explanation:
      "A stitch made with one needle thread and one bobbin thread that lock together inside the fabric. It looks the same on both sides and does not stretch much.",
  },
  {
    id: "double-chain-stitch",
    iso: "401",
    name: "Double chain stitch",
    explanation:
      "A stitch made with one needle thread and one looper thread, which forms a chain on the underside. It stretches more than a lockstitch.",
  },
  {
    id: "two-needle-bottom-cover-stitch",
    iso: "406",
    name: "Two needle bottom cover stitch",
    explanation:
      "A stretchy stitch with two parallel lines of needle thread on top and a covering thread on the underside. It is the usual hem stitch of a knitted tee.",
  },
  {
    id: "three-thread-overedge",
    iso: "504",
    name: "Three thread overedge",
    explanation:
      "An overlock stitch made with one needle thread and two looper threads. It sews the seam and wraps the raw edge in one pass.",
  },
  {
    id: "four-thread-overedge",
    iso: "514",
    name: "Four thread overedge",
    explanation:
      "An overlock stitch made with two needle threads and two looper threads. It sews the seam and wraps the raw edge in one pass, and it is stronger than the three thread stitch.",
  },
  {
    id: "two-needle-cover-stitch",
    iso: "602",
    name: "Two needle cover stitch",
    explanation:
      "A stretchy stitch with two parallel lines of needle thread on top. The cover thread lies on top and the looper thread underneath. It is often used on hems and necklines of knitted fabric.",
  },
  {
    id: "three-needle-cover-stitch",
    iso: "605",
    name: "Three needle cover stitch",
    explanation:
      "A stretchy stitch with three parallel lines on top and a covering thread underneath. It is wider than the two needle cover stitch and is used where a flat, strong finish is wanted.",
  },
  {
    id: "flatlock",
    iso: "607",
    name: "Four needle flatlock",
    explanation:
      "A wide, flat stitch with four needle threads that covers a join where two edges meet, on both sides. It leaves no ridge inside, so it is used on garments worn close to the skin.",
  },
];

export const SEAM_CLASSES: readonly SeamClass[] = [
  {
    id: "superimposed",
    iso: "1",
    name: "Superimposed seam",
    explanation: "Two pieces of fabric are laid one on top of the other and sewn together near the edge.",
  },
  {
    id: "lapped",
    iso: "2",
    name: "Lapped seam",
    explanation: "Two pieces of fabric overlap, and are sewn together through both layers.",
  },
  {
    id: "bound",
    iso: "3",
    name: "Bound seam",
    explanation: "A strip of fabric is folded over the raw edge of one or more pieces and sewn on to enclose it.",
  },
  {
    id: "flat",
    iso: "4",
    name: "Flat seam",
    explanation: "Two pieces of fabric meet edge to edge, without overlapping, and a stitch covers the join.",
  },
  {
    id: "edge-finishing",
    iso: "6",
    name: "Edge finish",
    explanation: "The raw edge of a single piece is turned under or covered and sewn, as on a hem.",
  },
];
