import type { SupabaseClient } from "@supabase/supabase-js";
import type { Finding } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { createCheckRegistry } from "./registry";
import { loadFactoryProfile, readDesignStatus, writeDesignStatus } from "./service";
import { statusSentence, transition, type StatusRecord } from "./status";
import { validateDesign, type ValidationResult } from "./validate";
import type { DesignInput } from "./registry";

export interface Report extends ValidationResult {
  readonly profileName: string;
  readonly profileLabel: string;
  readonly status: StatusRecord["status"];
  readonly statusSentence: string;
  readonly findings: readonly Finding[];
}

/** Runs the checks and reads the stored status. Writes nothing. */
export async function reportFor(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  version: number,
  design: DesignInput,
): Promise<Report> {
  const [profile, status] = await Promise.all([loadFactoryProfile(client), readDesignStatus(client, brandId, projectId, version)]);
  const result = validateDesign(design, profile, createCheckRegistry());
  return { ...result, profileName: profile.name, profileLabel: profile.label, status: status.status, statusSentence: statusSentence(status) };
}

/** Moves a version to validated, or back to draft. Ordering is not offered here: the order flow does it. */
export async function moveStatus(
  deps: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  version: number,
  to: "validated" | "draft",
  design: DesignInput,
  now: Date,
): Promise<Report> {
  const [profile, current] = await Promise.all([loadFactoryProfile(deps.client), readDesignStatus(deps.client, who.brandId, projectId, version)]);
  const result = validateDesign(design, profile, createCheckRegistry());
  const moved = transition(current, to, { profileId: profile.id, findings: result.findings, at: now });
  if (!moved.ok) throw new AppError("conflict", moved.reason);
  await writeDesignStatus(deps.admin, who, projectId, version, to, moved.record);
  return { ...result, profileName: profile.name, profileLabel: profile.label, status: moved.record.status, statusSentence: statusSentence(moved.record) };
}
