"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useRemote } from "../orders/useRemote";
import { ZoneOverlay } from "./ZoneOverlay";

const projectIdFrom = (params: ReturnType<typeof useParams>): string | null => {
  const value = params?.projectId;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
};

type Orders = Readonly<{ orders: readonly Readonly<{ id: string; name: string; players: number }>[] }>;

/** Print files: one file for every piece in every size, as a zip made when you ask for it. */
export function PrintPanel() {
  const projectId = projectIdFrom(useParams());
  const teamLists = useRemote<Orders>(projectId ? `/api/projects/${projectId}/orders` : "/api/projects/none/orders");
  const [order, setOrder] = useState("");
  const lists = projectId ? (teamLists.data?.orders ?? []) : [];
  const query = `formats=pdf,svg${order === "" ? "" : `&order=${encodeURIComponent(order)}`}`;
  return (
    <section aria-labelledby="print-files-heading" data-testid="print-files-panel" className="flex flex-col gap-2">
      <h3 id="print-files-heading" className="text-[15px] font-medium text-ink">Print files</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">
        One file for every piece in every size, at full size with extra print past the cut line. The zip is made when you ask and is not kept.
        Each file says in its margin what to look at before it goes to the printer. The pieces come from your pattern library: add the pattern for this garment in Patterns first.
      </p>
      <ZoneOverlay />
      <p className="text-[12px] leading-relaxed text-chalk-muted">
        Places for marks: crest, sponsor, number on the front, name, number on the back, sleeve badge and sleeve band.
      </p>
      {projectId && lists.length > 0 ? (
        <label className="flex flex-col gap-1 text-[13px] text-ink">
          Also make a set of files for each player in a team list
          <select value={order} onChange={(event) => setOrder(event.target.value)} className="rounded border border-chalk-muted/40 bg-transparent px-2 py-1">
            <option value="">No team list</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.players} players)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {projectId ? (
        <a
          href={`/api/projects/${projectId}/print-files?${query}`}
          className="text-[13px] font-medium text-ink underline"
          download
        >
          Download print files (PDF and SVG)
        </a>
      ) : null}
    </section>
  );
}
