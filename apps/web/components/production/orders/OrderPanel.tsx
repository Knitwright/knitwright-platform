"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ReleasePanel } from "../release/ReleasePanel";
import { call, projectUrl } from "./call";
import { OrderEditor } from "./OrderEditor";
import { useRemote } from "./useRemote";
import { blankRow, type Context, type OrderDraft, type OrderSummary, type Row } from "./types";

type Listing = Readonly<{ orders: readonly OrderSummary[]; context: Context }>;
type Opened = Readonly<{ id: string; name: string; rows: readonly Row[] }>;

const INTRO = "Names, numbers and sizes for a whole team go here, with a list of shirts to make for each size.";

function Orders({ projectId }: Readonly<{ projectId: string }>) {
  const { data: listing, problem: loadProblem, reload } = useRemote<Listing>(projectUrl(projectId, "orders"));
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  const problem = loadProblem ?? openProblem;

  const open = async (id: string) => {
    const reply = await call<Opened>(projectUrl(projectId, `orders/${id}`), "GET");
    if (reply.ok) setDraft({ id: reply.data.id, name: reply.data.name, rows: reply.data.rows });
    else setOpenProblem(reply.message);
  };

  if (problem) return <Notice tone="warn" role="alert">{problem}</Notice>;
  if (!listing) return <p className="text-[13px] text-chalk-muted">Loading team lists.</p>;
  if (draft) {
    return (
      <OrderEditor
        key={draft.id ?? "new"}
        projectId={projectId}
        context={listing.context}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          reload();
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {listing.orders.length === 0 ? <p className="text-[13px] text-chalk-muted">No team lists yet.</p> : null}
      <ul className="flex flex-col gap-1">
        {listing.orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between gap-3 text-[14px] text-ink">
            <span>{order.name} <span className="text-muted">({order.players} rows)</span></span>
            <Button variant="quiet" onClick={() => void open(order.id)}>Open<span className="sr-only"> {order.name}</span></Button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={() => setDraft({ id: null, name: "", rows: [blankRow(listing.context)] })}>Add a team list</Button>
      </div>
    </div>
  );
}

/** The team orders of the design, and the releases made from them. It needs a design open, so it reads the design from the address. */
export function OrderPanel() {
  const projectId = useParams<{ projectId?: string }>()?.projectId;
  return (
    <section aria-labelledby="team-orders-heading" data-testid="team-orders-panel" className="flex flex-col gap-3">
      <h3 id="team-orders-heading" className="text-[15px] font-medium text-ink">Team orders</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">{INTRO}</p>
      {projectId ? (
        <>
          <Orders projectId={projectId} />
          <ReleasePanel projectId={projectId} inputs={null} />
        </>
      ) : null}
    </section>
  );
}
