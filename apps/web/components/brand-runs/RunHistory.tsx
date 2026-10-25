import { STAGE_LABELS } from "@/lib/brand-runs/stage";
import type { ProductView } from "@/lib/brand-runs/service";

const sizesOf = (sizes: Readonly<Record<string, number>>): string =>
  Object.entries(sizes).map(([label, pieces]) => `${label} ${pieces}`).join(", ");

/** The samples and runs sent for each product, with where the order is in ops. Read only. */
export function RunHistory({ products }: Readonly<{ products: readonly ProductView[] }>) {
  const rows = products.flatMap((product) => product.runs.map((run) => ({ product, run })));
  if (rows.length === 0) return <p className="text-[15px] text-muted">Nothing has been sent to ops yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {rows.map(({ product, run }) => (
        <li key={run.id} className="flex flex-col gap-1 py-3 text-[15px]">
          <p className="text-ink">{product.name} · {run.kind === "sample" ? "Sample" : "Brand run"} · {run.pieces} {run.pieces === 1 ? "piece" : "pieces"}</p>
          <p className="text-muted">
            {sizesOf(run.sizes)} · sent {run.createdAt.slice(0, 10)} · product stage {STAGE_LABELS[product.stage].toLowerCase()} ·{" "}
            {run.order ? `in ops: ${run.order.status.replace("_", " ")}${run.order.promisedOn ? `, promised ${run.order.promisedOn}` : ", no promised date yet"}` : "ops status not available"}
          </p>
          {run.flags.length > 0 ? <p className="text-muted">Sent with notes: {run.flags.map((f) => f.text).join(" ")}</p> : null}
        </li>
      ))}
    </ul>
  );
}
