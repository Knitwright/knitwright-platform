import type { SupabaseClient } from "@supabase/supabase-js";
import { listFactoryEvents, listPackets } from "@/lib/job-packet/service";
import { EVENT_LABELS } from "@/lib/job-packet/steps";
import { livePacket, packetStateLine, sentLine } from "@/lib/job-packet/view";
import { formatDateTime } from "@/lib/projects/dates";
import { PacketForms } from "./PacketControls";

/**
 * The batch's factory link on the ops batch page (decision 0072): make, send again or revoke it, and what the
 * factory recorded. Read with the platform admin's own client, so the database's rules decide.
 */
export async function PacketSection({ client, batchId }: Readonly<{ client: SupabaseClient; batchId: string }>) {
  const [packets, events] = await Promise.all([listPackets(client, batchId), listFactoryEvents(client, batchId)]);
  const live = livePacket(packets);
  const now = new Date();
  return (
    <section aria-labelledby="job-packet" className="mt-8 flex flex-col gap-4">
      <h2 id="job-packet" className="text-lg font-semibold text-ink">Factory link</h2>
      <p className="text-sm text-muted">
        The factory opens the batch with this link, without an account: job sheet, orders, sizes, names and numbers, materials, the files ZIP and the due date. Its buttons move the orders on.
      </p>
      {live ? <p className="text-sm text-ink" data-testid="job-packet-state">{packetStateLine(live, now)}. {sentLine(live)}.</p> : null}
      <PacketForms batchId={batchId} packetId={live?.id ?? null} />
      <h3 className="text-base font-semibold text-ink">From the factory</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {events.map((e) => (
            <li key={e.id} data-testid="factory-event" className="border-t border-hairline py-1.5">
              <span className="font-medium text-ink">{EVENT_LABELS[e.kind]}</span> <span className="text-muted">{formatDateTime(e.at)}</span>
              {e.ordersMoved > 0 ? <span className="text-muted"> · {e.ordersMoved} {e.ordersMoved === 1 ? "order" : "orders"} moved on</span> : null}
              {e.note ? <span className="text-ink-2"> · {e.note}</span> : null}
              {e.photoKey ? (
                <>
                  {" · "}
                  <a href={`/api/job/events/${e.id}/photo`} className="underline" target="_blank" rel="noreferrer">See photo</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
