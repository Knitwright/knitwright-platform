import { z } from "zod";

const shipmentRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  provider: z.enum(["manual", "courier"]),
  courier: z.string(),
  tracking_number: z.string(),
  shipped_on: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  pieces: z.number().int(),
  note: z.string(),
  courier_code: z.string().nullable().default(null),
  tracking_url: z.string().nullable().default(null),
  at: z.string(),
});

export interface Shipment {
  readonly id: string;
  readonly orderId: string;
  /** "manual": ops typed it in. "courier": an adapter booked it. No adapter exists yet (decision 0100). */
  readonly provider: "manual" | "courier";
  readonly courier: string;
  readonly trackingNumber: string;
  /** A date, year-month-day. */
  readonly shippedOn: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly note: string;
  /** The courier row it was recorded against, or null when ops chose none. */
  readonly courierCode: string | null;
  /** The courier's own tracking page, or null when no address is on file. Never invented. */
  readonly trackingUrl: string | null;
  readonly at: string;
}

export const SHIPMENT_COLUMNS = "id, order_id, provider, courier, tracking_number, shipped_on, sizes, pieces, note, courier_code, tracking_url, at";

export const toShipment = (data: unknown): Shipment => {
  const r = shipmentRow.parse(data);
  return {
    id: r.id,
    orderId: r.order_id,
    provider: r.provider,
    courier: r.courier,
    trackingNumber: r.tracking_number,
    shippedOn: r.shipped_on,
    sizes: r.sizes,
    pieces: r.pieces,
    note: r.note,
    courierCode: r.courier_code,
    trackingUrl: r.tracking_url,
    at: new Date(r.at).toISOString(),
  };
};
