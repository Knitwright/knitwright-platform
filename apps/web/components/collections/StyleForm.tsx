"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { saveStyleAction } from "@/lib/collections/actions";
import { minorFrom, parseSizes, splitFrom } from "@/lib/collections/entry";
import type { CollectionPlan } from "@/lib/collections/types";
import { STYLE_STATUS_LABELS, STYLE_STATUSES } from "@/lib/collections/vocabulary";

type Product = Readonly<{ id: string; name: string }>;
type Props = Readonly<{ plan: CollectionPlan; products: readonly Product[]; canEdit: boolean }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const BLANK = {
  name: "",
  colourway: "",
  status: "draft" as (typeof STYLE_STATUSES)[number],
  frameId: "",
  productId: "",
  articleCode: "",
  fabricCode: "",
  productionClass: "",
  wholesale: "",
  rrp: "",
  split: "0",
  sizes: "",
};

/**
 * Adds a style card to the plan (spec F-S10, "Style cards"). Every structural field is the design's own:
 * the article and fabric codes are typed as the catalogue writes them and checked by the database, and
 * nothing here invents a price -- the unit cost comes from the tiers, and only the brand's own wholesale
 * price and RRP are typed.
 */
export function StyleForm({ plan, products, canEdit }: Props) {
  const router = useRouter();
  const ids = { name: useId(), colourway: useId(), status: useId(), group: useId(), product: useId(), article: useId(), fabric: useId(), klass: useId(), wholesale: useId(), rrp: useId(), split: useId(), sizes: useId() };
  const [form, setForm] = useState(BLANK);
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof BLANK, value: string) => setForm((now) => ({ ...now, [field]: value }));

  const send = () => {
    const parsed = parseSizes(form.sizes);
    if (parsed.findings.length > 0) return setNote({ tone: "warn", text: parsed.findings[0]!.message });
    const wholesale = minorFrom(form.wholesale);
    const rrp = minorFrom(form.rrp);
    const split = splitFrom(form.split);
    if (wholesale === "unreadable" || rrp === "unreadable") return setNote({ tone: "warn", text: "Write a price as 29 or 29.50." });
    if (split === "unreadable") return setNote({ tone: "warn", text: "Write the wholesale share as a percentage from 0 to 100." });

    start(async () => {
      const reply = await saveStyleAction({
        collectionId: plan.id,
        styleId: null,
        frameId: form.frameId === "" ? null : form.frameId,
        productId: form.productId === "" ? null : form.productId,
        name: form.name.trim(),
        status: form.status,
        colourway: form.colourway.trim(),
        articleCode: form.articleCode.trim() === "" ? null : form.articleCode.trim().toUpperCase(),
        fabricCode: form.fabricCode.trim() === "" ? null : form.fabricCode.trim().toUpperCase(),
        productionClass: form.productionClass === "" ? null : (form.productionClass as "A" | "B"),
        wholesaleMinor: wholesale,
        rrpMinor: rrp,
        wholesaleSplitBp: split,
        sizes: parsed.sizes,
        x: 0,
        y: 0,
      }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The style could not be saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `${form.name.trim()} is on the board.` });
      setForm(BLANK);
      router.refresh();
    });
  };

  if (!canEdit) return <p className="text-sm text-muted">Only owners, admins and kit managers can change a collection plan.</p>;

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <h3 className="text-base font-medium text-ink">Add a style</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={ids.name} label="Name">
          <input id={ids.name} required maxLength={80} className={FIELD_CONTROL} value={form.name} onChange={(event) => set("name", event.target.value)} />
        </Field>
        <Field id={ids.colourway} label="Colourway">
          <input id={ids.colourway} maxLength={60} className={FIELD_CONTROL} value={form.colourway} onChange={(event) => set("colourway", event.target.value)} />
        </Field>
        <Field id={ids.status} label="Status">
          <select id={ids.status} className={FIELD_CONTROL} value={form.status} onChange={(event) => set("status", event.target.value)}>
            {STYLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STYLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.group} label="Group">
          <select id={ids.group} className={FIELD_CONTROL} value={form.frameId} onChange={(event) => set("frameId", event.target.value)}>
            <option value="">No group</option>
            {plan.frames.map((frame) => (
              <option key={frame.id} value={frame.id}>
                {frame.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.product} label="Product" hint="A sample can only be ordered against a product.">
          <select id={ids.product} className={FIELD_CONTROL} value={form.productId} onChange={(event) => set("productId", event.target.value)}>
            <option value="">Not listed yet</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.article} label="Article code" hint="Such as JSY-SS-01. The price tier is read for this article.">
          <input id={ids.article} className={FIELD_CONTROL} value={form.articleCode} onChange={(event) => set("articleCode", event.target.value)} placeholder="JSY-SS-01" />
        </Field>
        <Field id={ids.fabric} label="Fabric code" hint="Such as F-POLY-INT.">
          <input id={ids.fabric} className={FIELD_CONTROL} value={form.fabricCode} onChange={(event) => set("fabricCode", event.target.value)} placeholder="F-POLY-INT" />
        </Field>
        <Field id={ids.klass} label="Production class">
          <select id={ids.klass} className={FIELD_CONTROL} value={form.productionClass} onChange={(event) => set("productionClass", event.target.value)}>
            <option value="">Not set</option>
            <option value="A">Class A</option>
            <option value="B">Class B</option>
          </select>
        </Field>
        <Field id={ids.wholesale} label={`Wholesale price (${plan.currency})`}>
          <input id={ids.wholesale} inputMode="decimal" className={FIELD_CONTROL} value={form.wholesale} onChange={(event) => set("wholesale", event.target.value)} placeholder="29.00" />
        </Field>
        <Field id={ids.rrp} label={`RRP (${plan.currency})`}>
          <input id={ids.rrp} inputMode="decimal" className={FIELD_CONTROL} value={form.rrp} onChange={(event) => set("rrp", event.target.value)} placeholder="59.00" />
        </Field>
        <Field id={ids.split} label="Wholesale share (%)" hint="The rest of the units are D2C.">
          <input id={ids.split} inputMode="decimal" className={FIELD_CONTROL} value={form.split} onChange={(event) => set("split", event.target.value)} />
        </Field>
        <Field id={ids.sizes} label="Sizes and pieces" hint='Written as "S:10, M:20".'>
          <input id={ids.sizes} className={FIELD_CONTROL} value={form.sizes} onChange={(event) => set("sizes", event.target.value)} placeholder="S:10, M:20" />
        </Field>
      </div>
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" pending={pending} disabled={form.name.trim() === ""}>
          Add this style
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, hint, children }: Readonly<{ id: string; label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}
