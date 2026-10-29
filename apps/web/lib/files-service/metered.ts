import type { Answered, FilesService, FilesServiceShapes } from "./contract";
import { isPaid, type FilesServiceOperation } from "./operations";

/**
 * Metering on the files-service operations that call a commercial model (plan v5, "Rules every
 * workstream follows"). The estimated cost is reserved through `lib/usage` before the call and
 * given back when the call does not produce an answer, exactly as the image provider does.
 * An operation that is only compute on our own service is not metered.
 */

export type Reservation = Readonly<{ ok: true; eventId: string }> | Readonly<{ ok: false; refused: string }>;

export type MeterLike = Readonly<{
  reserve: (request: Readonly<{ userId: string; brandId: string; cost: Readonly<{ feature: "ai" | "photoreal"; microdollars: number }>; route: string }>) => Promise<Reservation>;
  refund: (eventId: string) => Promise<boolean>;
}>;

export type Payer = Readonly<{ userId: string; brandId: string }>;

/**
 * ESTIMATES, NOT PRICES. No provider has been chosen for any of these, so these are placeholder
 * reservations that let the caps work; the owner sets real numbers when a provider is picked.
 * Questions for the owner are in the decision record.
 */
export const ESTIMATED_COST: Readonly<Record<FilesServiceOperation, Readonly<{ feature: "ai" | "photoreal"; microdollars: number }> | null>> = {
  draft_pattern: null,
  read_dxf: null,
  nest_marker: null,
  fit_check: null,
  render_garment: { feature: "photoreal", microdollars: 40_000 },
  transfer_design: { feature: "photoreal", microdollars: 40_000 },
  composite_logo: { feature: "photoreal", microdollars: 10_000 },
  detect_brand_marks: { feature: "ai", microdollars: 5_000 },
};

/**
 * Wraps a files service so every paid operation is reserved first. A refused reservation never
 * reaches the service, so a cap stops a paid call before it starts (decision 0012).
 */
export function meteredFilesService(service: FilesService, meter: MeterLike, payer: Payer): FilesService {
  return {
    name: `${service.name}+metered`,
    health: service.health,
    call: async <K extends FilesServiceOperation>(operation: K, request: FilesServiceShapes[K]["request"], signal?: AbortSignal): Promise<Answered<FilesServiceShapes[K]["answer"]>> => {
      const cost = ESTIMATED_COST[operation];
      if (!isPaid(operation) || cost === null) return service.call(operation, request, signal);
      const reservation = await meter.reserve({ ...payer, cost, route: `files-service/${operation}` });
      if (!reservation.ok) {
        return { ok: false, failure: "refused", message: "This month's allowance for generated images is used up. It starts again next month." };
      }
      const answer = await service.call(operation, request, signal);
      if (!answer.ok) await meter.refund(reservation.eventId);
      return answer;
    },
  };
}
