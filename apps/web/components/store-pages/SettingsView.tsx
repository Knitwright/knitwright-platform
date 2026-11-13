"use client";

import { Check, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { tabPanelProps, Tabs } from "@/components/ui/Tabs";
import { saveStoreSettingsAction } from "@/lib/store-pages/actions";
import type { StoreSettingsInput } from "@/lib/store-pages/settings";

/**
 * Store settings (09 screen 25, prototype p17): sub-tabs General · Shipping · Product safety · Packaging (EPR) ·
 * Notifications. Product safety has GPSR's two tables, "Completed by Knitwright" and "Needed from you"; Packaging
 * has Germany's LUCID number, France's Triman mark and the UK's threshold note. Owners and admins save; everyone
 * else reads.
 */

const SUBTABS = [
  { id: "general", label: "General" },
  { id: "shipping", label: "Shipping" },
  { id: "safety", label: "Product safety" },
  { id: "epr", label: "Packaging (EPR)" },
  { id: "notifications", label: "Notifications" },
] as const;

type SubTab = (typeof SUBTABS)[number]["id"];

const KNITWRIGHT_FILLS = [
  ["Manufacturer", "Knitwright partner factory, Sialkot, Pakistan"],
  ["Product labels", "Fibre content, care symbols, country of origin, batch number"],
  ["Safety information", "No small parts or cords on kids' sizes · flammability note"],
] as const;

function RegTable({ heading, children }: Readonly<{ heading: string; children: ReactNode }>) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <h3 className="bg-soft px-5 py-3 text-caption font-semibold uppercase tracking-wide text-text">{heading}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, children, mark }: Readonly<{ label: string; children: ReactNode; mark?: "done" | "info" | "todo" }>) {
  const icon = mark === "done" ? Check : mark === "info" ? Info : ChevronRight;
  return (
    <div className="grid items-center gap-2 px-5 py-3 text-body md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_auto]">
      <span className="text-text">{label}</span>
      <div className="min-w-0 text-text-2">{children}</div>
      {mark ? <Icon icon={icon} size={16} className="text-muted" /> : <span />}
    </div>
  );
}

type Props = Readonly<{ initial: StoreSettingsInput; canManage: boolean; euReady: boolean }>;

export function SettingsView({ initial, canManage, euReady }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<SubTab>("safety");
  const [values, setValues] = useState(initial);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const [pending, start] = useTransition();

  const set = (key: keyof StoreSettingsInput) => (event: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: event.target.value });
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      const reply = await saveStoreSettingsAction(values).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "Not saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: "Saved." });
      router.refresh();
    });
  };

  const footer = canManage ? (
    <div className="flex flex-col gap-3">
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" pending={pending}>
          Save
        </Button>
      </div>
    </div>
  ) : (
    <Notice tone="info">Only owners and admins change the store settings.</Notice>
  );

  return (
    <div className="flex flex-col gap-6">
      <Tabs items={SUBTABS} value={tab} onChange={(id) => setTab(id as SubTab)} label="Store settings" idBase="store-settings" variant="pill" />
      <div {...tabPanelProps("store-settings", tab)} className="flex flex-col gap-5 outline-none">
        {tab === "general" ? (
          <p className="text-body text-muted">
            Your store uses your brand&apos;s name and markets. Change them in{" "}
            <Link href="/settings" className="font-semibold text-link">
              Settings
            </Link>
            .
          </p>
        ) : null}
        {tab === "shipping" ? <p className="text-body text-muted">Knitwright packs and ships every order to your buyers, tracked, with duty paid where a market needs it. Delivery dates are shown on each product.</p> : null}
        {tab === "notifications" ? (
          <p className="text-body text-muted">
            Which emails you get about orders and payouts is set in{" "}
            <Link href="/settings" className="font-semibold text-link">
              Settings
            </Link>
            .
          </p>
        ) : null}
        {tab === "safety" ? (
          <form onSubmit={save} noValidate className="flex flex-col gap-5" data-testid="gpsr-form">
            <header>
              <h2 className="text-h2 text-text">Product safety (GPSR)</h2>
              <p className="mt-1 text-body text-muted">Needed to sell into the EU and Northern Ireland. Great Britain follows UK product safety rules; we print fibre, care and origin labels for every product.</p>
            </header>
            <RegTable heading="Completed by Knitwright">
              {KNITWRIGHT_FILLS.map(([label, value]) => (
                <Row key={label} label={label} mark="done">
                  {value}
                </Row>
              ))}
            </RegTable>
            <RegTable heading="Needed from you">
              <Row label="EU responsible person">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field name="euRpName" label="Name" maxLength={120} value={values.euRpName} onChange={set("euRpName")} disabled={!canManage} />
                  <Field name="euRpAddress" label="Address" maxLength={400} value={values.euRpAddress} onChange={set("euRpAddress")} disabled={!canManage} />
                  <Field name="euRpEmail" label="Email" type="email" maxLength={254} value={values.euRpEmail} onChange={set("euRpEmail")} disabled={!canManage} />
                </div>
              </Row>
              <Row label="Your brand contact">
                <Field name="brandContact" label="Shown on listings and inserts" maxLength={254} value={values.brandContact} onChange={set("brandContact")} disabled={!canManage} />
              </Row>
            </RegTable>
            {euReady ? null : <Notice tone="warn">Until an EU responsible person is saved, your products are not sold into the EU or Northern Ireland.</Notice>}
            {footer}
          </form>
        ) : null}
        {tab === "epr" ? (
          <form onSubmit={save} noValidate className="flex flex-col gap-5" data-testid="epr-form">
            <header>
              <h2 className="text-h2 text-text">Packaging (EPR)</h2>
              <p className="mt-1 text-body text-muted">Packaging rules by country. Germany needs a LUCID number before you ship there. UK packaging EPR applies above a turnover threshold.</p>
            </header>
            <RegTable heading="Country">
              <Row label="Germany" mark="info">
                <Field name="lucidNumber" label="LUCID registration number" placeholder="DE1234567890123" maxLength={18} value={values.lucidNumber} onChange={set("lucidNumber")} disabled={!canManage} />
              </Row>
              <Row label="France" mark="done">
                Triman logo and sorting info added to inserts
              </Row>
              <Row label="United Kingdom" mark="info">
                Check if your turnover is over the threshold · placeholder
              </Row>
            </RegTable>
            {footer}
          </form>
        ) : null}
      </div>
    </div>
  );
}
