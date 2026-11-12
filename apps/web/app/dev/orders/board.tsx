import { Board } from "@/components/collections/Board";
import { StyleCard } from "@/components/collections/StyleCard";
import { TotalsBar } from "@/components/collections/TotalsBar";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { linePlan } from "@/lib/collections/line-plan";
import type { CollectionPlan, Style } from "@/lib/collections/types";
import type { StyleStatus } from "@/lib/collections/vocabulary";

/** The range plan board (p13) with made-up styles, for the fixture page. Nothing is priced. */

const frame = (id: string, name: string, x: number) => ({ id, name, x, y: 0 });

const style = (id: string, frameId: string, name: string, status: StyleStatus, fabricCode: string, qty: number): Style => ({
  id, frameId, productId: null, projectId: null, name, status, colourway: "Navy", articleCode: "JSY-SS-01", fabricCode,
  productionClass: "A", wholesaleMinor: 2400, rrpMinor: 4500, wholesaleSplitBp: 6000,
  sizes: [{ label: "S", qty: Math.floor(qty / 2) }, { label: "M", qty: Math.ceil(qty / 2) }], x: 0, y: 0,
});

const PLAN: CollectionPlan = {
  id: "plan", name: "Spring drop", destinationCountry: "GB", currency: "GBP", notes: "", updatedAt: "2026-11-01T00:00:00Z",
  frames: [frame("f1", "Teamwear", 0), frame("f2", "Core", 1), frame("f3", "Fight", 2), frame("f4", "Lifestyle", 3)],
  styles: [
    style("s1", "f1", "Home shirt 2027", "approved", "F-POLY-INT", 250),
    style("s2", "f2", "Compression top v3", "approved", "F-POLY-EL", 150),
    style("s3", "f3", "Fight shorts", "draft", "F-POLY-4W", 100),
    style("s4", "f4", "Hoodie", "draft", "F-STK-FLC", 80),
    style("s5", "f1", "Away shirt 2027", "sampling", "F-POLY-INT", 180),
  ],
};

export function DevBoard() {
  const cards = Object.fromEntries(
    PLAN.styles.map((one) => [
      one.id,
      <StyleCard key={one.id} style={one} collectionId={PLAN.id} currency="GBP" canEdit={false} facts={{ fabric: one.fabricCode ?? "Not set", moq: "10 pieces", targetCost: "£12.40" }} art={<GarmentOutline />} />,
    ]),
  );
  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-h1 text-text">Collection plan · {PLAN.name}</h1>
      <Board plan={PLAN} cards={cards} canEdit />
      <TotalsBar totals={linePlan(PLAN, {}).totals} currency="GBP" />
    </div>
  );
}
