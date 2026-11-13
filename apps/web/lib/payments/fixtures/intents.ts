import { randomUUID } from "node:crypto";
import type { OrderLineIntent } from "../checkout";
import type { LinePrice } from "../pricing";

/** An order line as a make door would hand it to checkout, for the unit tests. */
export const intent = (price: LinePrice, over: Partial<OrderLineIntent> = {}): OrderLineIntent => ({
  requestKey: randomUUID(),
  door: "make",
  productId: randomUUID(),
  projectId: randomUUID(),
  kind: "sample",
  releaseId: randomUUID(),
  factoryProfileId: "knitwright-default",
  fabricKey: "mesh-140",
  sizes: { M: 1, L: 1, XL: 1 },
  flags: [],
  pieces: 3,
  price,
  ...over,
});

export const priced = (valueMinor: number): LinePrice => ({ status: "priced", unitMinor: valueMinor, valueMinor, label: "Placeholder price" });
export const unpriced: LinePrice = { status: "unpriced", reason: "No price is on file for this article yet." };
