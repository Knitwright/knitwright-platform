import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfQcFailed } from "../qc/errors";
import { manualCourier, type Courier, type CourierProvider } from "./courier";
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
  /** The courier as ops knows it, in their own words. */
  readonly courier: string;
  readonly trackingNumber: string;
  readonly shippedOn: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly note: string;
  /** Needed when the parcel leaves pieces behind. */
  readonly rest: Readonly<{ owner: string; dueOn: string }> | null;
  /** The courier row it was recorded against, when ops chose one. Null: none on file, so no tracking link. */
  readonly courierRow?: Courier | null;
}

interface RecordedShipment {
  readonly shipmentId: string;
  readonly pieces: number;
  readonly complete: boolean;
  /** What the courier provider did, in plain words. The manual option says nothing was booked. */
  readonly outcome: string;
  readonly trackingUrl: string | null;
}

/**
 * Records a parcel. The courier provider is asked first, so a real adapter would have one seam to land on and
 * one place to meter; the only implementation is the manual option, which books nothing. The database refuses
 * the parcel unless the order is ready and its latest inspection is a pass.
 */
export async function recordShipment(admin: Admin, actor: string, parcel: ParcelToRecord, provider: CourierProvider = manualCourier): Promise<RecordedShipment> {
  const booked = await provider.book({ courier: parcel.courierRow ?? null, courierName: parcel.courier, trackingNumber: parcel.trackingNumber });
  const { data, error } = await admin.rpc("ops_record_shipment", {
    p_actor: actor,
    p_order_id: parcel.orderId,
    p_courier: booked.courier,
    p_tracking_number: booked.trackingNumber,
    p_shipped_on: parcel.shippedOn,
    p_sizes: parcel.sizes,
    p_note: parcel.note,
    p_owner: parcel.rest?.owner ?? null,
    p_due_on: parcel.rest?.dueOn ?? null,
    p_provider: booked.provider,
    p_courier_code: booked.courierCode,
    p_tracking_url: booked.trackingUrl,
  });
  throwIfQcFailed(error);
  const row = (Array.isArray(data) ? data[0] : data) as { shipment_id: string; shipped_pieces: number; complete: boolean } | undefined;
  if (!row) throw new Error("ops_record_shipment answered with nothing");
  return { shipmentId: row.shipment_id, pieces: row.shipped_pieces, complete: row.complete, outcome: booked.outcome, trackingUrl: booked.trackingUrl };
}
