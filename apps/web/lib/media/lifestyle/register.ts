import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogEvent } from "@/lib/server/core/guard";
import type { UsageMeter } from "@/lib/usage/meter";
import type { MediaGenerator } from "../contract";
import type { StudioDesign } from "../studio";
import { DEFAULT_DAILY_CAP_MICRODOLLARS, spentTodayBy, usageBudget } from "./budget";
import { lifestyleGenerator, type LifestyleReport } from "./generator";
import { selectProviders, type LifestyleEnv } from "./select";

export type RegisterDeps = Readonly<{
  env: LifestyleEnv;
  usage: UsageMeter;
  /** The member's own client: usage rows are read with it. */
  client: SupabaseClient;
  brandId: string;
  userId: string;
  loadDesign: (design: { projectId: string; version: number }) => Promise<StudioDesign | null>;
  log: (event: LogEvent) => void;
}>;

/** A whole number of microdollars above zero, or the default. */
export const dailyCapFrom = (value: string | undefined): number => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP_MICRODOLLARS;
};

/** The report goes to the log: which scenes were kept, which were dropped and why, and how many passed the first time. */
export const logReport = (log: RegisterDeps["log"], report: LifestyleReport): void => {
  const scenes = report.outcomes.map((o) => ({ scene: o.scene, kept: o.kept, dropped: o.dropped, attempts: o.attempts, rejectedFor: o.rejectedFor }));
  log({ level: "info", message: `Lifestyle pictures: ${report.kept} of ${report.total} kept, ${report.passedFirstTry} passed the first time. ${JSON.stringify(scenes)}`, where: "lifestyle" });
};

/**
 * The lifestyle generator for a media set, or none. None when `LIFESTYLE_SCENE_PROVIDER` and `LIFESTYLE_TRYON_PROVIDER` are
 * both unset (the default), so no provider is called and nothing is spent unless the owner has chosen one.
 */
export function lifestyleGenerators(deps: RegisterDeps): readonly MediaGenerator[] {
  const { providers, problems } = selectProviders(deps.env);
  for (const problem of problems) deps.log({ level: "warn", message: problem, where: "lifestyle" });
  if (providers.length === 0) return [];
  return [
    lifestyleGenerator({
      loadDesign: deps.loadDesign,
      providers,
      budget: usageBudget({
        usage: deps.usage,
        brandId: deps.brandId,
        userId: deps.userId,
        spentToday: () => spentTodayBy(deps.client, deps.brandId),
        dailyCapMicrodollars: dailyCapFrom(deps.env.LIFESTYLE_DAILY_CAP_MICRODOLLARS),
      }),
      onReport: (report) => logReport(deps.log, report),
      log: deps.log,
    }),
  ];
}
