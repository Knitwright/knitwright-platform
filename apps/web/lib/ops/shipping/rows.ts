import { z } from "zod";

const shipmentRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  provider: z.literal("manual"),
  courier: z.string(),
  tracking_number: z.string(),
  shipped_on: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  pieces: z.number().int(),
  note: z.string(),
  at: z.string(),
});

export interface Shipment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: "manual";
  readonly courier: string;
  readonly trackingNumber: string;
  /** A date, year-month-day. */
  readonly shippedOn: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly note: string;
  readonly at: string;
}

export const SHIPMENT_COLUMNS = "id, order_id, provider, courier, tracking_number, shipped_on, sizes, pieces, note, at";

export const toShipment = (data: unknown): Shipment => {
  const r = shipmentRow.parse(data);
  return { id: r.id, orderId: r.order_id, provider: r.provider, courier: r.courier, trackingNumber: r.tracking_number, shippedOn: r.shipped_on, sizes: r.sizes, pieces: r.pieces, note: r.note, at: new Date(r.at).toISOString() };
};
