import { WEEKDAYS } from "@/lib/ops/settings";
import { describeMissing, nextCutoff, type PromisedDate } from "@/lib/factory/dates";
import { describeTier, formatMoney } from "@/lib/factory/pricing";
import type { ProductionSettings } from "@/lib/factory/production-settings";
import type { Capability, FactorySnapshot } from "@/lib/factory/schemas";
import type { FactoryTable } from "@/lib/factory/store";
import { fieldViews } from "@/lib/factory/view";
import type { FactoryProfile } from "@/lib/validation/profile";
import { AddTierForm, FactoryFieldForm } from "./FactoryFieldForm";

type Row = Readonly<Record<string, unknown>>;

const CARD = "glass rounded-[1.75rem] p-6";

/** Every editable field of one row, as a grid of small forms. */
export function RowForms({ table, row }: Readonly<{ table: FactoryTable; row: Row }>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fieldViews(table, row).map((field) => <FactoryFieldForm key={field.column} field={field} />)}
    </div>
  );
}

const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function CutoffSummary({ settings, timeZone, now }: Readonly<{ settings: ProductionSettings; timeZone: string; now: Date }>) {
  const next = nextCutoff(now, settings.cutoff, timeZone);
  return (
    <p className="text-[15px] text-muted" data-testid="cutoff-summary">
      Class A cut-off: {WEEKDAYS[settings.cutoff.weekday]} {clock(settings.cutoff.minutes)} on the factory&apos;s clock ({timeZone}); next {next.toISOString().slice(0, 16).replace("T", " ")} UTC.
      {" "}QC: {settings.qcDays === null ? "not set" : `${settings.qcDays} working days`}.
      {settings.isPlaceholder ? " These are Knitwright placeholders; change them under Factory terms at /admin/settings." : ""}
    </p>
  );
}

function ProfileSummary({ profile }: Readonly<{ profile: FactoryProfile }>) {
  const ladder = profile.priceLadder.status === "set" ? profile.priceLadder.value.map((s) => `${s.fromPieces}+ at £${s.unitPrice.toFixed(2)}`).join(", ") : "not set";
  return (
    <p className="text-sm text-ink-2" data-testid="profile-summary">
      Profile read model ({profile.id}): {profile.articles.length} articles, lead time {profile.leadTimeDays.status === "set" ? `${profile.leadTimeDays.value} working days` : "not set"}, ladder {ladder}.
    </p>
  );
}

const promiseWords = (promise: PromisedDate): string =>
  promise.status === "set" ? `an order today to GB is promised for ${promise.promisedOn}` : `no delivery date yet. ${describeMissing(promise.missing)}`;

function CapabilityCard({ capability, snapshot, rows, promise }: Readonly<{ capability: Capability; snapshot: FactorySnapshot; rows: RowsByTable; promise: PromisedDate }>) {
  const tiers = snapshot.tiers.filter((t) => t.capabilityId === capability.id).sort((a, b) => a.qtyMin - b.qtyMin);
  return (
    <li className={CARD} data-testid="capability">
      <h4 className="font-semibold text-ink">{capability.articleCode} on {capability.fabricCode}</h4>
      <p className="mt-1 text-sm text-muted">{capability.label}. Rule {capability.ruleId}. Dates: {promiseWords(promise)}</p>
      <div className="mt-4"><RowForms table="factory_capabilities" row={rows.factory_capabilities.get(capability.id) ?? {}} /></div>
      <h5 className="mt-6 font-medium text-ink">Price tiers</h5>
      {tiers.length === 0 ? <p className="text-sm text-muted">No tiers: no price is set for this article.</p> : null}
      <ul className="mt-2 flex flex-col gap-4">
        {tiers.map((tier) => (
          <li key={tier.id} data-testid="tier">
            <p className="text-sm text-ink-2">
              {describeTier(tier)} pieces: {tier.sellGbpMinor === null ? "GBP not set" : formatMoney(tier.sellGbpMinor, "GBP")}, {tier.sellAudMinor === null ? "AUD not set" : formatMoney(tier.sellAudMinor, "AUD")}. {tier.label}. Rule {tier.ruleId}.
            </p>
            <div className="mt-2"><RowForms table="price_tiers" row={rows.price_tiers.get(tier.id) ?? {}} /></div>
          </li>
        ))}
      </ul>
      <div className="mt-4"><AddTierForm capabilityId={capability.id} /></div>
    </li>
  );
}

export type RowsByTable = Readonly<Record<FactoryTable, ReadonlyMap<string, Row>>>;

export function FactorySection(props: Readonly<{ snapshot: FactorySnapshot; profile: FactoryProfile; rows: RowsByTable; promises: ReadonlyMap<string, PromisedDate> }>) {
  const { snapshot, profile, rows, promises } = props;
  return (
    <section aria-labelledby={`factory-${snapshot.factory.slug}`} className="mt-10" data-testid="factory">
      <h2 id={`factory-${snapshot.factory.slug}`} className="text-xl font-semibold text-ink">{snapshot.factory.name}</h2>
      <p className="mt-1 text-sm text-muted">{snapshot.factory.city}, {snapshot.factory.country}. {snapshot.factory.label}.</p>
      <ProfileSummary profile={profile} />
      <div className={`mt-4 ${CARD}`}><RowForms table="factories" row={rows.factories.get(snapshot.factory.id) ?? {}} /></div>
      <h3 className="mt-8 text-lg font-semibold text-ink">What it makes</h3>
      <ul className="mt-4 flex flex-col gap-6">
        {snapshot.capabilities.map((capability) => (
          <CapabilityCard key={capability.id} capability={capability} snapshot={snapshot} rows={rows} promise={promises.get(capability.id)!} />
        ))}
      </ul>
    </section>
  );
}

/** A table's rows as cards, each with its forms. */
export function RowsSection({ title, table, rows, heading }: Readonly<{ title: string; table: FactoryTable; rows: readonly Row[]; heading: (row: Row) => string }>) {
  return (
    <section aria-labelledby={`section-${table}`} className="mt-10">
      <h2 id={`section-${table}`} className="text-xl font-semibold text-ink">{title}</h2>
      <ul className="mt-4 flex flex-col gap-6">
        {rows.map((row) => (
          <li key={String(row.id)} className={CARD} data-testid={`row-${table}`}>
            <h3 className="font-semibold text-ink">{heading(row)}</h3>
            <div className="mt-4"><RowForms table={table} row={row} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
