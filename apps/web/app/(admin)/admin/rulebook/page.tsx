import type { Metadata } from "next";
import { ConfirmRule } from "@/components/rulebook/ConfirmRule";
import { RuleEditor } from "@/components/rulebook/RuleEditor";
import { WhyLink } from "@/components/rulebook/WhyLink";
import { WhyPreview } from "@/components/rulebook/WhyPreview";
import { pageFrame } from "@/components/shell/page-width";
import { adminGroups, stamp, type AdminRule } from "@/lib/rulebook/admin-view";
import { loadEntries, loadGaps } from "@/lib/rulebook/store";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { loadNames } from "@/lib/settings/store";

export const metadata: Metadata = { title: "Rulebook", robots: { index: false, follow: false } };

function RuleItem({ rule }: Readonly<{ rule: AdminRule }>) {
  const { entry } = rule;
  return (
    <li className="glass rounded-[1.75rem] p-6" data-testid={`rule-${entry.ruleId}`}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        {entry.ruleId} · version {entry.version} · {rule.scope}
      </p>
      <h3 className="mt-2 font-semibold text-ink">{entry.title}</h3>
      <p className="mt-2 text-[15px] text-ink">{entry.rule}</p>
      <p className="mt-2 text-sm text-ink-2" data-testid={`status-${entry.ruleId}`}>
        {rule.status}
        {rule.confirmedByName ? `, recorded by ${rule.confirmedByName}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <WhyLink ruleId={entry.ruleId} context="admin rulebook" />
      </div>
      {entry.status === "draft" ? <div className="mt-4"><ConfirmRule ruleId={entry.ruleId} version={entry.version} /></div> : null}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-ink">Edit as a new version</summary>
        <div className="mt-3"><RuleEditor entry={entry} /></div>
      </details>
      {rule.earlier.length > 0 ? (
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer">Earlier versions ({rule.earlier.length})</summary>
          <ul className="mt-2 list-disc pl-5">
            {rule.earlier.map((old) => <li key={old.version}>Version {old.version}, {old.status}: {old.rule} {old.body}</li>)}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/**
 * The rulebook behind every "Why?" (decision 0067): every rule's newest version by topic, an editor that saves a new
 * version and never overwrites, a button to record the factory's confirmation, and the gaps people have met.
 * Platform admins only; everyone else gets the page that does not exist.
 */
export default async function RulebookPage() {
  await requirePlatformAdmin();
  const admin = adminClient();
  const [entries, gaps] = await Promise.all([loadEntries(admin, true), loadGaps(admin)]);
  const names = await loadNames(admin, entries.flatMap((e) => (e.confirmedBy ? [e.confirmedBy] : [])));
  const groups = adminGroups(entries, names);

  return (
    <main id="main" className={`rise ${pageFrame("content")} flex-1 py-10`}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Knitwright team</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Rulebook</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The words behind every Why? link. A rule is never overwritten: an edit saves the next version as a draft, and the
        newest version is the one people see. Times are UTC.
      </p>

      <section aria-labelledby="try" className="mt-8">
        <h2 id="try" className="text-xl font-semibold text-ink">Try a Why? link</h2>
        <div className="mt-4"><WhyPreview /></div>
      </section>

      <section aria-labelledby="gaps" className="mt-10">
        <h2 id="gaps" className="text-xl font-semibold text-ink">Gaps</h2>
        {gaps.length === 0 ? <p className="mt-3 text-[15px] text-ink-2">Nobody has met a missing rule yet.</p> : (
          <ul className="mt-4 flex flex-col gap-2 text-[15px] text-ink" data-testid="gaps">
            {gaps.map((gap) => (
              <li key={gap.code} data-testid={`gap-${gap.code}`}>
                <span className="font-mono">{gap.code}</span>: met {gap.count} {gap.count === 1 ? "time" : "times"}, last {stamp(gap.lastSeen)}
                {gap.context ? ` (${gap.context})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.map((group) => (
        <section key={group.topic} aria-labelledby={`topic-${group.topic}`} className="mt-10">
          <h2 id={`topic-${group.topic}`} className="text-xl font-semibold text-ink">{group.title}</h2>
          <ul className="mt-4 flex flex-col gap-6">{group.rules.map((rule) => <RuleItem key={rule.entry.ruleId} rule={rule} />)}</ul>
        </section>
      ))}

      <section aria-labelledby="new-rule" className="mt-10">
        <h2 id="new-rule" className="text-xl font-semibold text-ink">Add a rule</h2>
        <div className="glass mt-4 rounded-[1.75rem] p-6"><RuleEditor /></div>
      </section>
    </main>
  );
}
