import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfQcFailed } from "../qc/errors";
import { manualProvider, type ShippingProvider } from "./provider";
import { SHIPMENT_COLUMNS, toShipment, type Shipment } from "./rows";

type Admin = Pick<SupabaseClient, "rpc">;

/** Every parcel of an order, oldest first. */
export async function listShipments(client: SupabaseClient, orderId: string): Promise<readonly Shipment[]> {
  const { data, error } = await client.from("ops_shipments").select(SHIPMENT_COLUMNS).eq("order_id", orderId).order("at").order("id").limit(200);
  throwIfQcFailed(error);
  return (data ?? []).map(toShipment);
}

export interface ParcelToRecord {
  readonly orderId: string;
  readonly courier: string;
  readonly trackingNumber: string;
  readonly shippedOn: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly note: string;
  /** Needed when the parcel leaves pieces behind. */
  readonly rest: Readonly<{ owner: string; dueOn: string }> | null;
}

interface RecordedShipment {
  readonly shipmentId: string;
  readonly pieces: number;
  readonly complete: boolean;
}

/** Records a parcel. The database refuses it unless the order is ready and its latest inspection is a pass. */
export async function recordShipment(admin: Admin, actor: string, parcel: ParcelToRecord, provider: ShippingProvider = manualProvider): Promise<RecordedShipment> {
  const prepared = await provider.prepare({ courier: parcel.courier, trackingNumber: parcel.trackingNumber });
  const { data, error } = await admin.rpc("ops_record_shipment", {
    p_actor: actor, p_order_id: parcel.orderId, p_courier: prepared.courier, p_tracking_number: prepared.trackingNumber, p_shipped_on: parcel.shippedOn,
    p_sizes: parcel.sizes, p_note: parcel.note, p_owner: parcel.rest?.owner ?? null, p_due_on: parcel.rest?.dueOn ?? null,
  });
  throwIfQcFailed(error);
  const row = (Array.isArray(data) ? data[0] : data) as { shipment_id: string; shipped_pieces: number; complete: boolean } | undefined;
  if (!row) throw new Error("ops_record_shipment answered with nothing");
  return { shipmentId: row.shipment_id, pieces: row.shipped_pieces, complete: row.complete };
}
