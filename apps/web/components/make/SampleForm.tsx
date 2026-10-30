"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { requestSampleAction } from "@/lib/make/actions";
import type { MakeContext } from "@/lib/make/context";
import { checkSampleRequest, describeSample } from "@/lib/make/sample";
import { SAMPLE_MAX_SIZES } from "@/lib/make/vocabulary";

type Props = Readonly<{ context: MakeContext; canOrder: boolean }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const newKey = (): string => crypto.randomUUID();

/**
 * The sample request (F-S7): up to three sizes, one piece of each, with the price and the delivery date shown
 * before anything is sent. There is no payment here: the order is handed to production and Knitwright invoices
 * it outside the platform (owner decision 1).
 */
export function SampleForm({ context, canOrder }: Props) {
  const router = useRouter();
  const ids = { release: useId(), fabric: useId(), sizes: useId() };
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<readonly string[]>(context.sampleSizes.slice(0, 1));
  const [releaseId, setReleaseId] = useState(context.releases[0]?.id ?? "");
  const [fabric, setFabric] = useState(context.fabricKey);
  const [requestKey, setRequestKey] = useState(newKey);
  const [note, setNote] = useState<Note | null>(null);

  const check = useMemo(() => checkSampleRequest({ sizes: chosen, sizeRun: context.sizeRun }), [chosen, context.sizeRun]);
  const product = context.product;

  const toggle = (size: string) => {
    setNote(null);
    setChosen((now) => (now.includes(size) ? now.filter((one) => one !== size) : [...now, size]));
  };

  const send = () => {
    if (!product) return setNote({ tone: "warn", text: "List this design as a product first." });
    if (releaseId === "") return setNote({ tone: "warn", text: "Choose the frozen release to make." });
    if (fabric.trim() === "") return setNote({ tone: "warn", text: "Name the fabric before sending." });
    start(async () => {
      const reply = await requestSampleAction({ projectId: context.projectId, productId: product.id, releaseId, fabricKey: fabric.trim(), sizes: [...chosen], requestKey }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The request could not be sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Sent to production. The order is ${reply.data.status}, waiting for the next cut-off.` });
      setRequestKey(newKey());
      router.refresh();
    });
  };

  if (!canOrder) return <p className="text-sm text-muted">Only owners, admins and kit managers can order samples.</p>;

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Sizes, one piece each (up to {SAMPLE_MAX_SIZES})</legend>
        {context.sizeRun.length === 0 ? (
          <Notice>This design has no size run yet, and no base article gives one. Set the sizes in the design first.</Notice>
        ) : (
          <div className="flex flex-wrap gap-2" id={ids.sizes}>
            {context.sampleSizes.map((size) => (
              <label key={size} className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[15px] text-ink">
                <input type="checkbox" className="size-4" checked={chosen.includes(size)} onChange={() => toggle(size)} />
                {size}
              </label>
            ))}
          </div>
        )}
        <p className="text-sm text-muted" aria-live="polite">{describeSample(check)}</p>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor={ids.release} className="text-sm font-medium text-ink">Frozen release to make</label>
          <select id={ids.release} required className={FIELD_CONTROL} value={releaseId} onChange={(event) => setReleaseId(event.target.value)}>
            {context.releases.length === 0 ? <option value="">No release yet</option> : null}
            {context.releases.map((release) => (
              <option key={release.id} value={release.id}>Release {release.number} · {release.label}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor={ids.fabric} className="text-sm font-medium text-ink">Fabric</label>
          {context.factory.fabricKeys.length > 0 ? (
            <select id={ids.fabric} required className={FIELD_CONTROL} value={fabric} onChange={(event) => setFabric(event.target.value)}>
              {context.factory.fabricKeys.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          ) : (
            <input id={ids.fabric} required maxLength={120} className={FIELD_CONTROL} value={fabric} onChange={(event) => setFabric(event.target.value)} placeholder="Name the fabric" />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[15px]" aria-live="polite">
        <p className="text-muted">Price: {context.prices[0]?.text}</p>
        <p className="text-muted">{context.delivery.text}</p>
        {context.delivery.note === "" ? null : <p className="text-sm text-faint">{context.delivery.note}</p>}
      </div>

      {context.releases.length === 0 ? <Notice>This design has no frozen release yet. Freeze one from the design, then come back.</Notice> : null}
      {check.findings.length > 0 && chosen.length > 0 ? <Notice tone="warn" role="alert">{check.findings.map((found) => found.message).join(" ")}</Notice> : null}
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}

      <div>
        <Button type="submit" pending={pending} disabled={!check.canSend || releaseId === "" || product === null}>Send the sample request</Button>
      </div>
    </form>
  );
}
