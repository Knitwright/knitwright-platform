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

/** Size labels: the design's size run, or the ones typed in when it has none. */
function useSizeLabels(sizeRun: readonly string[]) {
  const [extra, setExtra] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState("");
  const labels = sizeRun.length > 0 ? sizeRun : extra;
  const addLabel = () => {
    const label = draft.trim();
    if (label === "" || label.length > 16 || labels.includes(label)) return;
    setExtra((now) => [...now, label]);
    setDraft("");
  };
  return { labels, draft, setDraft, addLabel };
}

/** The builder's state and the order it sends. */
function useRunOrder(product: ProductView, context: RunContext) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<RunKind>(product.stage === "run" ? "run" : "sample");
  const [releaseId, setReleaseId] = useState(context.releases[0]?.id ?? "");
  const [fabric, setFabric] = useState(context.fabrics[0] ?? "");
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestKey, setRequestKey] = useState(newKey);
  const [note, setNote] = useState<Note | null>(null);

  const set = (label: string, value: string) => {
    setTyped((now) => ({ ...now, [label]: value }));
    setAcknowledged(false);
  };

  const send = () => {
    if (releaseId === "") return setNote({ tone: "warn", text: "Choose the frozen release to make." });
    if (fabric.trim() === "") return setNote({ tone: "warn", text: "Name the fabric before sending." });
    start(async () => {
      const reply = await orderRunAction({ productId: product.id, kind, releaseId, fabricKey: fabric, quantities: numbersOf(typed), acknowledgeFlags: acknowledged, requestKey }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The order could not be sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Sent to ops. The order is ${reply.data.status}, waiting for the next cut-off.` });
      setTyped({});
      setAcknowledged(false);
      setRequestKey(newKey());
      router.refresh();
    });
  };
  return { pending, kind, setKind, releaseId, setReleaseId, fabric, setFabric, typed, set, acknowledged, setAcknowledged, note, send };
}

/** The run builder: a size breakdown for one product, checked as it is typed, sent to ops as a sample or a run. */
export function RunBuilder({ product, context, canEdit }: Props) {
  const ids = { kind: useId(), release: useId(), fabric: useId(), ack: useId(), add: useId() };
  const order = useRunOrder(product, context);
  const { kind, typed, acknowledged } = order;
  const sizes = useSizeLabels(context.sizeRun);
  const result = useMemo(() => checkBreakdown({ kind, quantities: numbersOf(typed), sizeRun: context.sizeRun, moq: context.moq }), [kind, typed, context]);
  const quote = quoteFor(result.total, context.ladder);
  const blocked = whyNotOrder(product.stage, kind);

  if (!canEdit) return <p className="text-sm text-muted">Only owners, admins and kit managers can place orders.</p>;

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); order.send(); }}>
      <p className="text-[15px] text-muted">
        {context.designName} · {context.garmentLabel} · design version {product.designVersion}. Factory terms: {context.factoryLabel}.
      </p>
      <RunChoices ids={ids} stage={product.stage} context={context} order={order} />

      <SizeInputs
        kind={kind}
        idPrefix={ids.kind}
        addId={ids.add}
        labels={sizes.labels}
        hasSizeRun={context.sizeRun.length > 0}
        draft={sizes.draft}
        onDraft={sizes.setDraft}
        onAdd={sizes.addLabel}
        typed={typed}
        onType={order.set}
      />

      <RunSummary kind={kind} total={result.total} quoteText={quote.text} moq={context.moq} />

      {result.errors.length > 0 && result.total + Object.keys(typed).length > 0 ? <Notice tone="warn" role="alert">{result.errors.join(" ")}</Notice> : null}
      {result.flags.length > 0 ? <FlagsNotice flags={result.flags} ackId={ids.ack} acknowledged={acknowledged} onAcknowledge={order.setAcknowledged} /> : null}
      {blocked ? <Notice>{blocked}</Notice> : null}
      {order.note ? <Notice tone={order.note.tone} role={order.note.tone === "warn" ? "alert" : "status"}>{order.note.text}</Notice> : null}

      <div>
        <Button type="submit" pending={order.pending} disabled={blocked !== null || order.releaseId === "" || result.errors.length > 0 || (result.flags.length > 0 && !acknowledged)}>
          {kind === "sample" ? "Order sample" : "Order run"}
        </Button>
      </div>
    </form>
  );
}

type RunChoicesProps = Readonly<{
  ids: Readonly<{ kind: string; release: string; fabric: string }>;
  stage: ProductView["stage"];
  context: RunContext;
  order: ReturnType<typeof useRunOrder>;
}>;

/** What to order, the frozen release to make and the fabric. */
function RunChoices({ ids, stage, context, order }: RunChoicesProps) {
  const { kind, releaseId, fabric } = order;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor={ids.kind} className="text-sm font-medium text-ink">What to order</label>
          <select id={ids.kind} className={FIELD_CONTROL} value={kind} onChange={(e) => { order.setKind(e.target.value as RunKind); order.setAcknowledged(false); }}>
            <option value="sample" disabled={!canOrder(stage, "sample")}>Sample: one piece per size</option>
            <option value="run" disabled={!canOrder(stage, "run")}>Brand run</option>
          </select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor={ids.release} className="text-sm font-medium text-ink">Frozen release to make</label>
          <select id={ids.release} required className={FIELD_CONTROL} value={releaseId} onChange={(e) => order.setReleaseId(e.target.value)}>
            {context.releases.length === 0 ? <option value="">No release yet</option> : null}
            {context.releases.map((release) => <option key={release.id} value={release.id}>Release {release.number} · {release.label}</option>)}
          </select>
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor={ids.fabric} className="text-sm font-medium text-ink">Fabric</label>
          {context.fabrics.length > 0 ? (
            <select id={ids.fabric} required className={FIELD_CONTROL} value={fabric} onChange={(e) => order.setFabric(e.target.value)}>
              {context.fabrics.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : (
            <input id={ids.fabric} required maxLength={120} className={FIELD_CONTROL} value={fabric} onChange={(e) => order.setFabric(e.target.value)} placeholder="Name the fabric" />
          )}
        </div>
      </div>
      {context.releases.length === 0 ? (
        <Notice>This design has no frozen release yet. Freeze one from the design, then come back; a sample is a release like any other.</Notice>
      ) : null}
    </>
  );
}

type FlagsNoticeProps = Readonly<{
  flags: ReturnType<typeof checkBreakdown>["flags"];
  ackId: string;
  acknowledged: boolean;
  onAcknowledge: (acknowledged: boolean) => void;
}>;

function FlagsNotice({ flags, ackId, acknowledged, onAcknowledge }: FlagsNoticeProps) {
  return (
    <Notice tone="warn">
      <ul className="list-disc pl-5">{flags.map((flag) => <li key={flag.code}>{flag.text}</li>)}</ul>
      <label htmlFor={ackId} className="mt-3 flex items-start gap-2 text-ink">
        <input id={ackId} type="checkbox" className="mt-1 size-5" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} />
        I have read these notes and want to send this anyway.
      </label>
    </Notice>
  );
}

type SizeInputsProps = Readonly<{
  kind: RunKind;
  idPrefix: string;
  addId: string;
  labels: readonly string[];
  hasSizeRun: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  typed: Readonly<Record<string, string>>;
  onType: (label: string, value: string) => void;
}>;

function SizeInputs({ kind, idPrefix, addId, labels, hasSizeRun, draft, onDraft, onAdd, typed, onType }: SizeInputsProps) {
  return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">{kind === "sample" ? "Sizes for the sample (1 piece each)" : "Pieces per size"}</legend>
        {!hasSizeRun ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={addId} className="text-sm text-ink">Size label</label>
              <input id={addId} maxLength={16} className={FIELD_CONTROL} value={draft} onChange={(e) => onDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }} placeholder="M" />
            </div>
            <Button variant="secondary" type="button" onClick={onAdd}>Add size</Button>
            <p className="basis-full text-sm text-muted">This design has no size run set, so type the sizes you want to order.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {labels.map((label) => (
            <div key={label} className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-${label}`} className="text-sm text-ink">{`Size ${label}`}</label>
              <input id={`${idPrefix}-${label}`} inputMode="numeric" className={FIELD_CONTROL} value={typed[label] ?? ""} onChange={(e) => onType(label, e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>
      </fieldset>
  );
}

function RunSummary({ kind, total, quoteText, moq }: Readonly<{ kind: RunKind; total: number; quoteText: string; moq: RunContext["moq"] }>) {
  return (
      <div className="flex flex-col gap-1 text-[15px]" aria-live="polite">
        <p className="text-ink">Total: {total} {total === 1 ? "piece" : "pieces"}</p>
        {kind === "run" ? <p className="text-muted">Price: {quoteText}.</p> : <p className="text-muted">Price of a sample: Knitwright will quote.</p>}
        {moq.status === "set" ? <p className="text-muted">Minimum order for this garment: {moq.value} pieces. Brand runs are up to {MAX_RUN_PIECES}.</p> : <p className="text-muted">Minimum order: not set yet. Brand runs are up to {MAX_RUN_PIECES}.</p>}
      </div>
  );
}
