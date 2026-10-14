"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FabricView } from "@/lib/fabrics";

type State = Readonly<{ kind: "loading" } | { kind: "ready"; fabrics: readonly FabricView[] } | { kind: "failed" }>;

const readFabrics = async (): Promise<readonly FabricView[]> => {
  const response = await fetch("/api/fabrics");
  const body: unknown = await response.json();
  const data = (body as { success?: boolean; data?: { fabrics?: FabricView[] } }).data;
  if (!response.ok || !data?.fabrics) throw new Error("The fabrics could not be read.");
  return data.fabrics;
};

/** The base fabrics of the brand, with what is known about their stretch and shrink. */
export function FabricPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    readFabrics().then(
      (fabrics) => live && setState({ kind: "ready", fabrics }),
      () => live && setState({ kind: "failed" }),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <section aria-labelledby="fabrics-heading" data-testid="fabrics-panel" className="flex flex-col gap-2">
      <h3 id="fabrics-heading" className="text-[15px] font-medium text-ink">Fabrics</h3>
      {state.kind === "loading" ? <p className="text-[13px] text-chalk-muted">Loading your fabrics.</p> : null}
      {state.kind === "failed" ? <p className="text-[13px] text-chalk-muted">Your fabrics could not be loaded. Try again in a moment.</p> : null}
      {state.kind === "ready" ? (
        <ul className="flex flex-col gap-2">
          {state.fabrics.map((fabric) => (
            <li key={fabric.id} className="text-[13px] leading-relaxed text-chalk-muted">
              <span className="text-ink">{fabric.name}</span>: {fabric.printScale}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href="/brands/fabrics" className="text-[13px] font-medium text-ink underline">
        Open your fabric library
      </Link>
    </section>
  );
}
