"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { addProductAction, confirmStageAction } from "@/lib/brand-runs/actions";
import type { ProductView } from "@/lib/brand-runs/service";
import { canConfirm, nextStage, STAGE_LABELS } from "@/lib/brand-runs/stage";

type DesignChoice = Readonly<{ id: string; label: string }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

type Props = Readonly<{ products: readonly ProductView[]; designs: readonly DesignChoice[]; canEdit: boolean; selectedId: string | null }>;

const date = (iso: string): string => iso.slice(0, 10);

/** The product list: designs the brand has marked as products, each at idea, sample or run. */
export function ProductsPanel({ products, designs, canEdit, selectedId }: Props) {
  const router = useRouter();
  const designId = useId();
  const nameId = useId();
  const [pending, start] = useTransition();
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<Note | null>(null);

  const add = () =>
    start(async () => {
      const reply = await addProductAction({ projectId, name });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: "The product is in your list." });
      setProjectId("");
      setName("");
      router.push(`/brand?product=${reply.data.id}#builder`);
    });

  const confirm = (product: ProductView) =>
    start(async () => {
      const to = nextStage(product.stage);
      if (!to) return;
      const reply = await confirmStageAction({ productId: product.id, to });
      setNote(reply.success ? { tone: "ok", text: `${product.name} is now at the ${STAGE_LABELS[to].toLowerCase()} stage.` } : { tone: "warn", text: reply.error.message });
      if (reply.success) router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {products.length === 0 ? <p className="text-[15px] text-muted">No products yet. Choose a design below to start your list.</p> : null}
      <ul className="flex flex-col divide-y divide-hairline">
        {products.map((product) => {
          const next = nextStage(product.stage);
          const sampleOrdered = product.runs.some((run) => run.kind === "sample");
          return (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <p className="min-w-0 text-[15px] text-ink">
                <Link href={`/studio/${product.projectId}`} className="soft-link">{product.name}</Link>
                <span className="text-muted"> · {STAGE_LABELS[product.stage]} · design version {product.designVersion} · added {date(product.createdAt)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/brand?product=${product.id}#builder`} className="soft-link text-[15px] text-cobalt-soft" aria-current={selectedId === product.id ? "true" : undefined}>
                  {selectedId === product.id ? "Open in the run builder" : "Plan a sample or run"}
                </Link>
                {canEdit && next && canConfirm(product.stage, sampleOrdered) ? (
                  <Button variant="secondary" type="button" pending={pending} onClick={() => confirm(product)}>
                    {next === "sample" ? "Move to sample stage" : "Happy with the sample, move to run stage"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
      {canEdit ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor={designId} className="text-sm font-medium text-ink">Design to list</label>
            <select id={designId} required className={FIELD_CONTROL} value={projectId} onChange={(e) => { setProjectId(e.target.value); setName(designs.find((d) => d.id === e.target.value)?.label ?? ""); }}>
              <option value="">Choose a design</option>
              {designs.map((design) => <option key={design.id} value={design.id}>{design.label}</option>)}
            </select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium text-ink">Product name</label>
            <input id={nameId} required maxLength={80} className={FIELD_CONTROL} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" pending={pending}>Add to product list</Button>
        </form>
      ) : (
        <p className="text-sm text-muted">Only owners, admins and kit managers can change the product list.</p>
      )}
    </div>
  );
}
