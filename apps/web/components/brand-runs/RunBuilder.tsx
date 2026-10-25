"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { orderRunAction } from "@/lib/brand-runs/actions";
import { checkBreakdown, MAX_RUN_PIECES, numbersOf, type RunKind } from "@/lib/brand-runs/breakdown";
import { quoteFor } from "@/lib/brand-runs/quote";
import type { RunContext } from "@/lib/brand-runs/run-context";
import type { ProductView } from "@/lib/brand-runs/service";
import { canOrder, whyNotOrder } from "@/lib/brand-runs/stage";

type Props = Readonly<{ product: ProductView; context: RunContext; canEdit: boolean }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const newKey = (): string => crypto.randomUUID();

/** The run builder: a size breakdown for one product, checked as it is typed, sent to ops as a sample or a run. */
export function RunBuilder({ product, context, canEdit }: Props) {
  const router = useRouter();
  const ids = { kind: useId(), release: useId(), fabric: useId(), ack: useId(), add: useId() };
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<RunKind>(product.stage === "run" ? "run" : "sample");
  const [releaseId, setReleaseId] = useState(context.releases[0]?.id ?? "");
  const [fabric, setFabric] = useState(context.fabrics[0] ?? "");
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestKey, setRequestKey] = useState(newKey);
  const [note, setNote] = useState<Note | null>(null);

  const [extra, setExtra] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState("");
  const labels = context.sizeRun.length > 0 ? context.sizeRun : extra;
  const addLabel = () => {
    const label = draft.trim();
    if (label === "" || label.length > 16 || labels.includes(label)) return;
    setExtra((now) => [...now, label]);
    setDraft("");
  };
  const result = useMemo(() => checkBreakdown({ kind, quantities: numbersOf(typed), sizeRun: context.sizeRun, moq: context.moq }), [kind, typed, context]);
  const quote = quoteFor(result.total, context.ladder);
  const blocked = whyNotOrder(product.stage, kind);

  const set = (label: string, value: string) => {
    setTyped((now) => ({ ...now, [label]: value }));
    setAcknowledged(false);
  };

  const send = () =>
    start(async () => {
      const reply = await orderRunAction({ productId: product.id, kind, releaseId, fabricKey: fabric, quantities: numbersOf(typed), acknowledgeFlags: acknowledged, requestKey });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Sent to ops. The order is ${reply.data.status}, waiting for the next cut-off.` });
      setTyped({});
      setAcknowledged(false);
      setRequestKey(newKey());
      router.refresh();
    });

  if (!canEdit) return <p className="text-sm text-muted">Only owners, admins and kit managers can place orders.</p>;

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <p className="text-[15px] text-muted">
        {context.designName} · {context.garmentLabel} · design version {product.designVersion}. Factory terms: {context.factoryLabel}.
      </p>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor={ids.kind} className="text-sm font-medium text-ink">What to order</label>
          <select id={ids.kind} className={FIELD_CONTROL} value={kind} onChange={(e) => { setKind(e.target.value as RunKind); setAcknowledged(false); }}>
            <option value="sample" disabled={!canOrder(product.stage, "sample")}>Sample: one piece per size</option>
            <option value="run" disabled={!canOrder(product.stage, "run")}>Brand run</option>
          </select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor={ids.release} className="text-sm font-medium text-ink">Frozen release to make</label>
          <select id={ids.release} required className={FIELD_CONTROL} value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
            {context.releases.length === 0 ? <option value="">No release yet</option> : null}
            {context.releases.map((release) => <option key={release.id} value={release.id}>Release {release.number} · {release.label}</option>)}
          </select>
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor={ids.fabric} className="text-sm font-medium text-ink">Fabric</label>
          {context.fabrics.length > 0 ? (
            <select id={ids.fabric} required className={FIELD_CONTROL} value={fabric} onChange={(e) => setFabric(e.target.value)}>
              {context.fabrics.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : (
            <input id={ids.fabric} required maxLength={120} className={FIELD_CONTROL} value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="Name the fabric" />
          )}
        </div>
      </div>
      {context.releases.length === 0 ? (
        <Notice>This design has no frozen release yet. Freeze one from the design, then come back; a sample is a release like any other.</Notice>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">{kind === "sample" ? "Sizes for the sample (1 piece each)" : "Pieces per size"}</legend>
        {context.sizeRun.length === 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.add} className="text-sm text-ink">Size label</label>
              <input id={ids.add} maxLength={16} className={FIELD_CONTROL} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }} placeholder="M" />
            </div>
            <Button variant="secondary" type="button" onClick={addLabel}>Add size</Button>
            <p className="basis-full text-sm text-muted">This design has no size run set, so type the sizes you want to order.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {labels.map((label) => (
            <div key={label} className="flex flex-col gap-1">
              <label htmlFor={`${ids.kind}-${label}`} className="text-sm text-ink">{`Size ${label}`}</label>
              <input id={`${ids.kind}-${label}`} inputMode="numeric" className={FIELD_CONTROL} value={typed[label] ?? ""} onChange={(e) => set(label, e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1 text-[15px]" aria-live="polite">
        <p className="text-ink">Total: {result.total} {result.total === 1 ? "piece" : "pieces"}</p>
        {kind === "run" ? <p className="text-muted">Price: {quote.text}.</p> : <p className="text-muted">Price of a sample: Knitwright will quote.</p>}
        {context.moq.status === "set" ? <p className="text-muted">Minimum order for this garment: {context.moq.value} pieces. Brand runs are up to {MAX_RUN_PIECES}.</p> : <p className="text-muted">Minimum order: not set yet. Brand runs are up to {MAX_RUN_PIECES}.</p>}
      </div>

      {result.errors.length > 0 && result.total + Object.keys(typed).length > 0 ? <Notice tone="warn" role="alert">{result.errors.join(" ")}</Notice> : null}
      {result.flags.length > 0 ? (
        <Notice tone="warn">
          <ul className="list-disc pl-5">{result.flags.map((flag) => <li key={flag.code}>{flag.text}</li>)}</ul>
          <label htmlFor={ids.ack} className="mt-3 flex items-start gap-2 text-ink">
            <input id={ids.ack} type="checkbox" className="mt-1 size-5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            I have read these notes and want to send this anyway.
          </label>
        </Notice>
      ) : null}
      {blocked ? <Notice>{blocked}</Notice> : null}
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}

      <div>
        <Button type="submit" pending={pending} disabled={blocked !== null || releaseId === "" || result.errors.length > 0 || (result.flags.length > 0 && !acknowledged)}>
          {kind === "sample" ? "Order sample" : "Order run"}
        </Button>
      </div>
    </form>
  );
}
