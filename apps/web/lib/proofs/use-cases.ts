import type { SupabaseClient } from "@supabase/supabase-js";
import { today } from "./schemas";
import type { decideStrikeOffBody, signOffBody } from "./schemas";
import { addSignOff, decideStrikeOff } from "./service";
import type { z } from "zod";

type Who = Readonly<{ brandId: string; userId: string }>;

/** A named person accepts or rejects a strike-off. Without a typed date it is dated today. */
export async function decide(admin: SupabaseClient, who: Who, strikeOffId: string, body: z.output<typeof decideStrikeOffBody>, now: Date): Promise<void> {
  await decideStrikeOff(admin, who, { strikeOffId, accept: body.accept, name: body.name, role: body.role, on: body.on ?? today(now), note: body.note });
}

/** A named person signs a release for a role. Without a typed date it is dated today. */
export async function sign(admin: SupabaseClient, who: Who, releaseId: string, body: z.output<typeof signOffBody>, now: Date): Promise<string> {
  return addSignOff(admin, who, { releaseId, role: body.role, name: body.name, signedOn: body.signedOn ?? today(now), note: body.note });
}
