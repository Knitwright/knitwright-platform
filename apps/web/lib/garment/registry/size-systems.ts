import type { SizeSystem } from "../definitions";
import type { Wearer } from "../primitives";

/**
 * The size systems a size run can use. Men and women use adult sizes and youth use youth
 * sizes, unless a garment type names another system for a wearer, as sports bras do. The
 * size names themselves (such as S, M, L or 6Y, 8Y) come with the size charts from the owner.
 */
export const SIZE_SYSTEMS: readonly SizeSystem[] = [
  { id: "adult", label: "Adult sizes", help: "The brand's size run for men or for women, such as letter sizes." },
  { id: "youth", label: "Youth sizes", help: "The brand's size run for children, usually named by age or height." },
  {
    id: "sports-bra",
    label: "Sports bra sizes",
    help: "A size run made for sports bras, which may be letter sizes or band and cup sizes.",
  },
];

/** The system each wearer uses when a garment type does not name another. */
export const USUAL_SIZE_SYSTEM: Readonly<Record<Wearer, string>> = {
  men: "adult",
  women: "adult",
  youth: "youth",
};
