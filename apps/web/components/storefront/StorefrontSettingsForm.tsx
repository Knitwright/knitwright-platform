"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FIELD_CONTROL, TEXT_AREA } from "@/components/ui/field-styles";
import { Notice } from "@/components/ui/Notice";
import { saveStorefrontAction } from "@/lib/storefront/actions";
import { DEFAULT_ROOT_DOMAIN } from "@/lib/storefront/host";
import { RETURNS_POLICY_MAX } from "@/lib/storefront/policy";
import { FieldLabel } from "./parts";

/**
 * STOREFRONT SETTINGS (spec F-L5; plan v6 C3, decision 0154): the address `<slug>.knitwright.com`, the name, live or
 * draft, the returns policy (shown on every product page and before payment) and the EU responsible person the GPSR
 * table asks for. C5's Store pages link here.
 */

export type StorefrontValues = Readonly<{ name: string; slug: string; status: "draft" | "live"; returnsPolicy: string; euResponsiblePerson: string }>;

type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

/** A refusal in words: the field messages where the form was not filled in right, else the message. */
export const failureText = (error: Readonly<{ message: string; fields?: Readonly<Record<string, readonly string[]>> }>): string =>
  (error.fields ? Object.values(error.fields).flat().join(" ") : "") || error.message;

export function StorefrontSettingsForm({ initial, canEdit }: Readonly<{ initial: StorefrontValues; canEdit: boolean }>) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();
  const ids = { name: useId(), slug: useId(), returns: useId(), eu: useId() };
  const set = (next: Partial<StorefrontValues>) => setValues((current) => ({ ...current, ...next }));

  const save = () =>
    start(async () => {
      const reply = await saveStorefrontAction(values).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "Nothing was saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: failureText(reply.error) });
      setNote({ tone: "ok", text: reply.data.status === "live" ? "Saved. Your storefront is live." : "Saved. Your storefront is a draft: nobody else can see it yet." });
      router.refresh();
    });

  return (
    <section aria-labelledby="storefront-settings" className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5">
      <h2 id="storefront-settings" className="text-h3 text-text">Storefront</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.name}>Name</FieldLabel>
          <input id={ids.name} className={FIELD_CONTROL} value={values.name} maxLength={80} disabled={!canEdit} onChange={(event) => set({ name: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.slug}>Address</FieldLabel>
          <div className="flex items-center gap-2">
            <input id={ids.slug} className={`${FIELD_CONTROL} min-w-0 flex-1`} value={values.slug} maxLength={40} disabled={!canEdit} aria-describedby={`${ids.slug}-domain`} onChange={(event) => set({ slug: event.target.value.toLowerCase() })} />
            <span id={`${ids.slug}-domain`} className="text-body text-muted">.{DEFAULT_ROOT_DOMAIN}</span>
          </div>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-semibold text-text">Visible to shoppers</legend>
        <div className="flex flex-wrap gap-4 text-body text-text-2">
          <label className="flex items-center gap-2"><input type="radio" name="storefront-status" className="accent-navy" checked={values.status === "draft"} disabled={!canEdit} onChange={() => set({ status: "draft" })} />Draft: only your team</label>
          <label className="flex items-center gap-2"><input type="radio" name="storefront-status" className="accent-navy" checked={values.status === "live"} disabled={!canEdit} onChange={() => set({ status: "live" })} />Live: anyone with the address</label>
        </div>
        <p className="text-caption text-muted">Whoever puts the storefront live is the person its weekly batches are ordered as.</p>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={ids.returns}>Returns policy</FieldLabel>
        <textarea id={ids.returns} rows={6} className={TEXT_AREA} value={values.returnsPolicy} maxLength={RETURNS_POLICY_MAX} disabled={!canEdit} onChange={(event) => set({ returnsPolicy: event.target.value })} />
        <span className="text-caption text-muted">Shown on every product page, and ticked by the shopper before they pay. A blank line starts a new paragraph.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={ids.eu}>EU responsible person (GPSR)</FieldLabel>
        <input id={ids.eu} className={FIELD_CONTROL} value={values.euResponsiblePerson} maxLength={300} disabled={!canEdit} placeholder="Name and address in the EU, needed to sell into the EU or Northern Ireland" onChange={(event) => set({ euResponsiblePerson: event.target.value })} />
      </div>
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
      <div>
        <Button pending={pending} disabledReason={canEdit ? undefined : "Only owners, admins and kit managers can change the storefront."} onClick={save}>
          Save storefront
        </Button>
      </div>
    </section>
  );
}
