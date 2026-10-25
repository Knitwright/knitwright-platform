import type { RosterRow } from "@/lib/production/contract";
import type { OpsOrder } from "../rows";
import type { Carton, PackBag } from "./rows";

export const NOT_SET = "Not set";

export interface PackingInput {
  readonly order: OpsOrder;
  readonly brandName: string;
  readonly bags: readonly PackBag[];
  readonly cartons: readonly Carton[];
  /** The team list the bags point into, or null when there is none or it was erased. */
  readonly roster: readonly RosterRow[] | null;
}

export interface PackingModel {
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly warnings: readonly string[];
  readonly cartons: readonly { no: string; weight: string; size: string; bags: string }[];
  readonly bags: readonly { no: string; label: readonly string[]; carton: string }[];
}

export const weightText = (g: number | null): string => (g === null ? NOT_SET : `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 3).replace(/0+$/, "").replace(/\.$/, "")} kg`);

/** `400 × 300 × 200 mm`, with "not set" for any side nobody typed in. */
export const sizeText = (c: Pick<Carton, "lengthMm" | "widthMm" | "heightMm">): string =>
  c.lengthMm === null && c.widthMm === null && c.heightMm === null ? NOT_SET : [c.lengthMm, c.widthMm, c.heightMm].map((n) => (n === null ? "not set" : String(n))).join(" × ") + " mm";

/** The lines printed on one bag's label: who, what size, which order, which bag. */
export function labelFor(bag: PackBag, count: number, order: Pick<OpsOrder, "externalRef">, roster: readonly RosterRow[] | null): readonly string[] {
  const line = bag.teamRowPosition === null ? undefined : roster?.[bag.teamRowPosition - 1];
  const head = line ? [line.name === "" ? "No name" : line.name, `Number ${line.number}`] : bag.teamRowPosition === null ? [] : ["Player not on the team list"];
  return [...head, `Size ${bag.sizeLabel}, ${bag.pieces} ${bag.pieces === 1 ? "piece" : "pieces"}`, `Order ${order.externalRef}`, `Bag ${bag.bagNo} of ${count}`];
}

const byBagNo = (a: PackBag, b: PackBag): number => a.bagNo - b.bagNo;
const byCartonNo = (a: Carton, b: Carton): number => a.cartonNo - b.cartonNo;

/** The packing list of one order. Pure and deterministic: nothing in it depends on the clock or on the order rows arrive in. */
export function buildPackingList(input: PackingInput): PackingModel {
  const { order } = input;
  const bags = [...input.bags].sort(byBagNo);
  const cartons = [...input.cartons].sort(byCartonNo);
  const pieces = bags.reduce((n, b) => n + b.pieces, 0);
  const warnings: string[] = [];
  if (bags.length === 0) warnings.push("No bags have been made for this order yet.");
  else if (pieces !== order.pieces) warnings.push(`The bags hold ${pieces} pieces and the order says ${order.pieces}. Ask before closing a carton.`);
  if (bags.some((b) => b.teamRowPosition !== null) && input.roster === null) warnings.push("The team list is gone (none, or it was erased), so the labels show size only.");
  for (const c of cartons) if (c.weightG === null || sizeText(c) === NOT_SET) warnings.push(`Carton ${c.cartonNo}: weight or size is not set. Weigh and measure it, then enter them.`);
  const unpacked = bags.filter((b) => b.packedAt === null).length;
  if (bags.length > 0 && unpacked > 0) warnings.push(`${unpacked} of ${bags.length} bags are not packed yet.`);
  return {
    title: `Packing list: ${order.externalRef}`,
    subtitle: `${input.brandName} · ${order.articleId} · ${order.release.label}`,
    summary: `${bags.length} ${bags.length === 1 ? "bag" : "bags"}, ${pieces} pieces, ${cartons.length} ${cartons.length === 1 ? "carton" : "cartons"}`,
    warnings,
    cartons: cartons.map((c) => ({ no: String(c.cartonNo), weight: weightText(c.weightG), size: sizeText(c), bags: String(bags.filter((b) => b.cartonNo === c.cartonNo).length) })),
    bags: bags.map((b) => ({ no: String(b.bagNo), label: labelFor(b, bags.length, order, input.roster), carton: b.cartonNo === null ? "Not packed" : `Carton ${b.cartonNo}` })),
  };
}
