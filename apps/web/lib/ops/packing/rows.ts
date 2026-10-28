import { z } from "zod";

const bagRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  bag_no: z.number().int(),
  team_order_id: z.uuid().nullable(),
  team_row_position: z.number().int().nullable(),
  size_label: z.string(),
  pieces: z.number().int(),
  carton_no: z.number().int().nullable(),
  packed_at: z.string().nullable(),
});

export interface PackBag {
  readonly id: string;
  readonly orderId: string;
  readonly bagNo: number;
  readonly teamOrderId: string | null;
  readonly teamRowPosition: number | null;
  readonly sizeLabel: string;
  readonly pieces: number;
  readonly cartonNo: number | null;
  readonly packedAt: string | null;
}

export const BAG_COLUMNS = "id, order_id, bag_no, team_order_id, team_row_position, size_label, pieces, carton_no, packed_at";

export const toBag = (data: unknown): PackBag => {
  const r = bagRow.parse(data);
  return { id: r.id, orderId: r.order_id, bagNo: r.bag_no, teamOrderId: r.team_order_id, teamRowPosition: r.team_row_position, sizeLabel: r.size_label, pieces: r.pieces, cartonNo: r.carton_no, packedAt: r.packed_at && new Date(r.packed_at).toISOString() };
};

const cartonRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  carton_no: z.number().int(),
  weight_g: z.number().int().nullable(),
  length_mm: z.number().int().nullable(),
  width_mm: z.number().int().nullable(),
  height_mm: z.number().int().nullable(),
});

/** A carton. Every measurement is what ops typed in, or null for "not set". */
export interface Carton {
  readonly id: string;
  readonly orderId: string;
  readonly cartonNo: number;
  readonly weightG: number | null;
  readonly lengthMm: number | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
}

export const CARTON_COLUMNS = "id, order_id, carton_no, weight_g, length_mm, width_mm, height_mm";

export const toCarton = (data: unknown): Carton => {
  const r = cartonRow.parse(data);
  return { id: r.id, orderId: r.order_id, cartonNo: r.carton_no, weightG: r.weight_g, lengthMm: r.length_mm, widthMm: r.width_mm, heightMm: r.height_mm };
};
