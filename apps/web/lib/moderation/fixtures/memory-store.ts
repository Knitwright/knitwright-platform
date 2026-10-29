import type { ModerationStore, NewCheck, TargetState } from "../store";
import type { Mark, TargetKind } from "../types";

type Kept = NewCheck & Readonly<{ id: string; seq: number; decision: "allowed" | "blocked" | null }>;

/** The store in memory, following the same rules as the database functions (moderation_human_allowed). For tests only. */
export function createMemoryStore(marks: readonly Mark[] = []) {
  const checks: Kept[] = [];
  let failRecord = false;
  const store: ModerationStore = {
    marks: async () => marks,
    async record(check) {
      if (failRecord) throw new Error("database down");
      const id = `check-${checks.length + 1}`;
      checks.push({ ...check, id, seq: checks.length + 1, decision: null });
      return id;
    },
    async latest(kind, ids) {
      const found = new Map<string, TargetState>();
      for (const c of [...checks].reverse()) {
        if (c.targetKind !== kind || !c.targetId || !ids.includes(c.targetId) || found.has(c.targetId)) continue;
        found.set(c.targetId, { targetId: c.targetId, result: c.verdict.result, decision: c.decision });
      }
      return [...found.values()];
    },
    async humanAllowed(kind: TargetKind, id: string) {
      const mine = checks.filter((c) => c.targetKind === kind && c.targetId === id);
      const allowed = mine.filter((c) => c.decision === "allowed").map((c) => c.seq);
      if (allowed.length === 0) return false;
      const last = Math.max(...allowed);
      return !mine.some((c) => c.seq > last && (c.decision === "blocked" || (c.decision === null && c.verdict.result !== "clear")));
    },
  };
  const decide = (id: string, decision: "allowed" | "blocked") => {
    const i = checks.findIndex((c) => c.id === id);
    checks[i] = { ...checks[i]!, decision };
  };
  return { store, checks, decide, failRecords: () => { failRecord = true; } };
}
