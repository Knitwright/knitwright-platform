import type { FabricView } from "@/lib/fabrics";
import { AddTestForm } from "./FabricForms";

/** One fabric: what is known about it, where each number came from, and its tests. */
function FabricCard({ fabric }: Readonly<{ fabric: FabricView }>) {
  return (
    <article aria-labelledby={`fabric-${fabric.id}`} className="rounded-2xl border border-hairline bg-surface p-5" data-testid="fabric-card">
      <h3 id={`fabric-${fabric.id}`} className="text-[15px] font-semibold text-ink">
        {fabric.name}
      </h3>
      {fabric.detail ? <p className="text-sm text-muted">{fabric.detail}</p> : null}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {fabric.values.map((row) => (
          <div key={row.id} className="flex flex-col">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-ink">
              {row.value} <span className="text-muted">· {row.source}{row.testedOn ? `, tested ${row.testedOn}` : ""}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-ink" data-testid="print-scale">
        {fabric.printScale}
      </p>
      {fabric.tests.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1 text-sm text-muted">
          {fabric.tests.map((test) => (
            <li key={test.id}>
              {test.line}
              {test.photos > 0 ? ` (${test.photos} ${test.photos === 1 ? "photo" : "photos"})` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No test yet. Until there is one, print files are not scaled for shrink.</p>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">Add a fabric test</summary>
        <div className="mt-4">
          <AddTestForm fabricId={fabric.id} fabricName={fabric.name} />
        </div>
      </details>
    </article>
  );
}

export function FabricList({ fabrics }: Readonly<{ fabrics: readonly FabricView[] }>) {
  return (
    <div className="flex flex-col gap-4">
      {fabrics.map((fabric) => (
        <FabricCard key={fabric.id} fabric={fabric} />
      ))}
    </div>
  );
}
