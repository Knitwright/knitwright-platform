import type { Metadata } from "next";
import { SettingForm } from "@/components/settings/SettingForm";
import { pageFrame } from "@/components/shell/page-width";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { SETTINGS } from "@/lib/settings/registry";
import { loadHistory, loadNames, loadStored } from "@/lib/settings/store";
import { buildGroups } from "@/lib/settings/view";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

/**
 * The platform settings console. Every value the owner answers in the questionnaire is set here without a deploy,
 * with a record of who changed it and when. Everyone who is not a platform admin gets the page that does not exist.
 * No secret or API key is kept here.
 */
export default async function SettingsPage() {
  await requirePlatformAdmin();
  const admin = adminClient();
  const stored = await loadStored(admin);
  const lists = await Promise.all(SETTINGS.map(async (s) => [s.key, await loadHistory(admin, s.key, 5)] as const));
  const history = Object.fromEntries(lists);
  const people = [...Object.values(stored).map((s) => s.setBy), ...lists.flatMap(([, lines]) => lines.map((l) => l.setBy))];
  const names = await loadNames(admin, people.filter((id): id is string => id !== null));
  const groups = buildGroups(stored, names, history);

  return (
    <main id="main" className={`rise ${pageFrame("content")} flex-1 py-10`}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Knitwright team</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Each value answers a question in the owner questionnaire. Until one is set, the platform uses a Knitwright default
        and says so. Times are UTC. Do not enter keys or passwords here.
      </p>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="mt-10">
          <h2 id={`group-${group.id}`} className="text-xl font-semibold text-ink">{group.title}</h2>
          <ul className="mt-4 flex flex-col gap-6">
            {group.settings.map((setting) => (
              <li key={setting.key} className="glass rounded-[1.75rem] p-6" data-testid="setting">
                <SettingForm setting={setting} />
                <p className="mt-3 text-sm text-ink-2" data-testid={`source-${setting.key}`}>{setting.source} (question {setting.question})</p>
                {setting.history.length > 0 ? (
                  <details className="mt-2 text-sm text-muted">
                    <summary>History</summary>
                    <ul className="mt-1 list-disc pl-5">{setting.history.map((line) => <li key={line}>{line}</li>)}</ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
