import { formatInput } from "./input";
import { GROUPS, SETTINGS } from "./registry";
import { provenance, storedValue, valueOf } from "./resolve";
import type { HistoryLine } from "./store";
import type { InputKind, StoredSettings } from "./types";

export const DEFAULT_NOTE = "Knitwright default, not agreed with a factory";

/** What the page shows for one setting. Plain data, so it can cross to the form. */
export interface SettingView {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly question: number;
  readonly input: InputKind;
  /** The value now in force, as the form shows it. */
  readonly text: string;
  readonly isSet: boolean;
  /** "Set by <admin> on <date>" or the default label. */
  readonly source: string;
  readonly history: readonly string[];
}

export interface GroupView {
  readonly id: string;
  readonly title: string;
  readonly settings: readonly SettingView[];
}

const describeLine = (line: HistoryLine, names: Readonly<Record<string, string>>, text: (value: unknown) => string): string => {
  const who = (line.setBy && names[line.setBy]) || "a platform admin";
  const what = line.value === null || line.value === undefined ? "went back to the Knitwright default" : `was set to ${text(line.value).replaceAll("\n", "; ") || "empty"}`;
  return `${line.setAt.slice(0, 10)}: ${what}, by ${who}`;
};

/** Every group of settings with its values, sources and history. `history` maps a key to its lines. */
export function buildGroups(
  stored: StoredSettings,
  names: Readonly<Record<string, string>>,
  history: Readonly<Record<string, readonly HistoryLine[]>>,
): readonly GroupView[] {
  return Object.entries(GROUPS).flatMap(([id, title]) => {
    const defs = SETTINGS.filter((s) => s.group === id);
    if (defs.length === 0) return [];
    const settings = defs.map((def): SettingView => {
      const isSet = storedValue(stored, def.key) !== undefined;
      const text = (value: unknown) => formatInput(def, value);
      return {
        key: def.key,
        label: def.label,
        help: def.help,
        question: def.question,
        input: def.input,
        text: text(valueOf(stored, def.key)),
        isSet,
        source: provenance(stored, [def.key], names) ?? DEFAULT_NOTE,
        history: (history[def.key] ?? []).map((line) => describeLine(line, names, text)),
      };
    });
    return [{ id, title, settings }];
  });
}
