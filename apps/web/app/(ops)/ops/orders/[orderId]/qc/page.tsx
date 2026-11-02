import type { Metadata, Route } from "next";
import Link from "next/link";
import { InspectionBookingForm } from "@/components/ops/InspectionBookingForm";
import { QcForm } from "@/components/ops/QcForm";
import { describeAql, describeLevel, describePlan, planFor, UNSOURCED_PLAN_NOTE } from "@/lib/ops/aql/plan";
import { loadAqlTable } from "@/lib/ops/aql/service";
import { listExceptions } from "@/lib/ops/exceptions/service";
import { EXCEPTION_LABELS } from "@/lib/ops/exceptions/rules";
import { BOOKING_STATE_LABELS, bookingBlocker } from "@/lib/ops/inspection/rules";
import { loadThirdPartyOverPieces } from "@/lib/ops/inspection/load";
import { listBookings } from "@/lib/ops/inspection/service";
import { CHECKLIST_LABELS } from "@/lib/ops/qc/checklist";
import { readingVerdict } from "@/lib/ops/qc/colour";
import { colourLimitOf, colourLimitProblem } from "@/lib/ops/qc/limits";
import { loadOrderOrNotFound } from "@/lib/ops/qc/order-page";
import { listColourReadings, listInspections } from "@/lib/ops/qc/service";
import { STATUS_LABELS } from "@/lib/ops/status";
import { factoryService } from "@/lib/factory/server";
import { formatDateTime } from "@/lib/projects/dates";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: quality control", robots: { index: false, follow: false } };

/** The factory's own colour tolerance, or null with the reason. A factory not on file has none. */
async function colourTolerance(slug: string): Promise<{ limit: number | null; note: string | null }> {
  try {
    const profile = await factoryService().profile(slug);
    return { limit: colourLimitOf(profile), note: colourLimitProblem(profile) };
  } catch {
    return { limit: null, note: `The factory "${slug}" is not on file, so it has no colour tolerance to judge a reading against.` };
  }
}

/** The quality gate of one order: the sampling plan, the inspections so far, and the form for the next. */
export default async function QcPage({ params }: PageProps<"/ops/orders/[orderId]/qc">) {
  await requirePlatformAdmin();
  const { client, order } = await loadOrderOrNotFound((await params).orderId);
  const admin = adminClient();
  const [inspections, exceptions, readings, aql, overPieces, bookings, colour] = await Promise.all([
    listInspections(client, order.id),
    listExceptions(client, { orderId: order.id }),
    listColourReadings(client, order.id),
    loadAqlTable(admin),
    loadThirdPartyOverPieces(admin),
    listBookings(client, order.id),
    colourTolerance(order.factoryProfileId),
  ]);
  const remakes = exceptions.filter((e) => e.kind === "remake");
  const ready = order.status === "ready";
  const plan = planFor(aql, order.pieces);
  const bookBlocker = bookingBlocker({ pieces: order.pieces, overPieces, status: order.status, alreadyBooked: bookings.length > 0 });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main id="main" className="rise">
      <p className="text-sm">
        <Link href={`/ops/orders/${order.id}` as Route} className="text-muted underline">
          Back to {order.externalRef}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Quality control: {order.externalRef}</h1>
      <p className="mt-1 text-[15px] text-muted">{STATUS_LABELS[order.status]}. A failed inspection blocks shipping and opens a remake line for the factory.</p>

      <section aria-labelledby="plan" className="mt-6">
        <h2 id="plan" className="text-lg font-semibold text-ink">Sampling plan</h2>
        {plan.status === "not-on-file" ? (
          <p className="mt-2 text-[15px] text-warn" data-testid="aql-missing">
            No sampling plan is on file for a lot of {order.pieces} pieces. Missing: {plan.missing.join("; ")}. Seed the ISO 2859-1 level II table before a
            plan can be shown; nothing is worked out without it.
          </p>
        ) : (
          <div className="mt-2 text-[15px] text-ink-2" data-testid="aql-plan">
            <p>{describePlan(plan, order.pieces)}</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {plan.levels.map((level) => (
                <li key={level.aql}>
                  AQL {describeAql(level.aql)} ({level.defectClass}): {describeLevel(level)} <span className="text-faint">{level.ruleId}</span>
                </li>
              ))}
            </ul>
            {plan.sourced ? null : (
              <p className="mt-2 text-sm text-warn" data-testid="aql-unsourced">
                {UNSOURCED_PLAN_NOTE}
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="record" className="mt-8">
        <h2 id="record" className="text-lg font-semibold text-ink">Record an inspection</h2>
        {ready ? (
          <div className="mt-3">
            <QcForm
              orderId={order.id}
              colourLimit={colour.limit}
              colourNote={colour.note}
              aqlCodeLetter={plan.status === "on-file" ? plan.codeLetter : ""}
              sampleSize={plan.status === "on-file" ? plan.sampleSize : null}
            />
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-muted">An order is inspected once the factory has marked it ready. Mark it ready on the order page first.</p>
        )}
      </section>

      <section aria-labelledby="third-party" className="mt-8">
        <h2 id="third-party" className="text-lg font-semibold text-ink">Third-party inspection</h2>
        {bookBlocker ? (
          <p className="mt-2 text-[15px] text-muted" data-testid="booking-blocker">
            {bookBlocker}
          </p>
        ) : (
          <div className="mt-3">
            <InspectionBookingForm orderId={order.id} place={order.factoryProfileId} today={today} />
          </div>
        )}
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing has been asked for on this order.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-hairline text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="py-2" data-testid="inspection-booking">
                {BOOKING_STATE_LABELS[b.state]} · {b.reference} · {b.pieces} pieces · asked {b.requestedOn} · {b.inspectOn ?? "no date given"}
                <p className="text-muted">{b.outcome}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history" className="mt-8">
        <h2 id="history" className="text-lg font-semibold text-ink">Inspections ({inspections.length})</h2>
        {inspections.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">None yet. Record the first inspection above; shipping waits for one that passes.</p>
        ) : (
          <ol className="mt-2 flex flex-col divide-y divide-hairline text-sm">
            {inspections.map((i) => (
              <li key={i.id} className="py-2" data-testid="inspection">
                <span className="font-medium text-ink">{i.result === "pass" ? "Pass" : "Fail"}</span> · {formatDateTime(i.at)} · {i.defectCount} of {i.sampleSize} pieces
                with a defect · {i.photoFileIds.length} photos{i.aqlCodeLetter ? ` · code letter ${i.aqlCodeLetter}` : " · no sampling plan on file"}
                <ul className="mt-1 text-muted">
                  {i.checklist.map((c) => (
                    <li key={c.key}>
                      {CHECKLIST_LABELS[c.key]}: {c.result.replace("_", " ")}
                    </li>
                  ))}
                  {i.measurements.map((m) => (
                    <li key={m.point}>
                      {m.point}: spec {m.specMm} mm, measured {m.measuredMm} mm, tolerance {m.toleranceMm} mm
                    </li>
                  ))}
                  {readings
                    .filter((r) => r.inspectionId === i.id)
                    .map((r) => (
                      <li key={r.id} data-testid="colour-reading">
                        {readingVerdict(r).text} <span className="text-faint">{r.ruleId}</span>
                      </li>
                    ))}
                </ul>
                {i.note ? <p className="text-muted">{i.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {remakes.length > 0 ? (
        <section aria-labelledby="remakes" className="mt-8">
          <h2 id="remakes" className="text-lg font-semibold text-ink">Remake lines</h2>
          <ul className="mt-2 text-sm text-ink-2">
            {remakes.map((e) => (
              <li key={e.id} data-testid="remake-line">
                {EXCEPTION_LABELS[e.kind]}: {Object.entries(e.detail).map(([size, n]) => `${size} ×${String(n)}`).join(", ")}. Owner {e.owner}, due {e.dueOn}.{" "}
                {e.status === "open" ? "Open" : `Resolved: ${e.resolution ?? ""}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
