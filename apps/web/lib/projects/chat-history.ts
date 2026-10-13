import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { BrowserFollowUp, StreamEvent } from "@/lib/intent/stream";
import type { LogEvent } from "@/lib/server/core/guard";
import { SAVED_TEXT, type StoredLine } from "./chat";

/**
 * The conversation with the assistant, kept for each design (public.assistant_messages), so a
 * person who comes back sees what was said. Reads go through the person's own client, so the
 * database's rules decide what they see. Writes go through the server's client. What is kept is
 * what was shown, never a signed proposal: an old answer is read again, not tapped again.
 */

/** The most lines shown when a design opens. Older ones stay kept. */
export const HISTORY_LIMIT = 100;
const BODY_MAX = 2000;
const LINE_MAX = 400;
const LINES_MAX = 40;

type Who = Readonly<{ brandId: string; projectId: string }>;

const line = (role: StoredLine["role"], kind: StoredLine["kind"], body: string, lines: readonly string[] = []): StoredLine => ({
  role,
  kind,
  body: body.slice(0, BODY_MAX),
  lines: lines.slice(0, LINES_MAX).map((text) => text.slice(0, LINE_MAX)),
});

const labels = (followUp: BrowserFollowUp): string[] => followUp.choices.map((choice) => choice.label);
const followUpLines = (followUps: readonly BrowserFollowUp[]): StoredLine[] =>
  followUps.map((followUp) => line("assistant", "question", followUp.text, labels(followUp)));

/** The assistant's lines for one answer, as the chat panel shows them. */
function answerLines(event: StreamEvent): StoredLine[] {
  if (event.type === "stage") return [];
  if (event.type === "failed") return [line("assistant", "failed", event.message)];
  const { outcome } = event;
  switch (outcome.kind) {
    case "applied":
      return [line("assistant", "applied", SAVED_TEXT, [...outcome.explanations, ...outcome.notes]), ...followUpLines(outcome.followUps ?? [])];
    case "question":
      return [line("assistant", "question", outcome.question, outcome.choices.map((choice) => choice.label))];
    case "rejection": {
      const followUps = outcome.followUps ?? [];
      if (followUps.length === 1) return [line("assistant", "rejection", outcome.reason, labels(followUps[0]))];
      return [line("assistant", "rejection", outcome.reason), ...followUpLines(followUps)];
    }
  }
}

/** The person's words and the assistant's answer to them. */
export const exchangeLines = (utterance: string, event: StreamEvent): StoredLine[] => [line("person", "text", utterance), ...answerLines(event)];

/** A choice the person made, and what it changed. */
export const choiceLines = (label: string, explanations: readonly string[]): StoredLine[] => [
  line("person", "text", label),
  line("assistant", "applied", SAVED_TEXT, explanations),
];

const rowSchema = z.object({
  role: z.enum(["person", "assistant"]),
  kind: z.enum(["text", "applied", "question", "rejection", "failed"]),
  body: z.string(),
  lines: z.array(z.string()),
});

/** The newest lines of a design's conversation, oldest first. */
export async function loadChatHistory(client: SupabaseClient, who: Who): Promise<StoredLine[]> {
  const { data, error } = await client
    .from("assistant_messages")
    .select("role, kind, body, lines")
    .eq("brand_id", who.brandId)
    .eq("project_id", who.projectId)
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error("The conversation could not be read.", { cause: error });
  return z.array(rowSchema).parse(data ?? []).reverse();
}

/**
 * The conversation for a page, or none when it cannot be read. The design is still worth
 * showing without it, so the failure is logged rather than shown.
 */
export async function conversationFor(client: SupabaseClient, who: Who, log: (event: LogEvent) => void): Promise<StoredLine[]> {
  try {
    return await loadChatHistory(client, who);
  } catch (error) {
    log({ level: "error", message: "The conversation could not be read", where: "design page", error });
    return [];
  }
}

/** Adds lines to a design's conversation, in order. */
export async function recordLines(admin: SupabaseClient, who: Who, lines: readonly StoredLine[]): Promise<void> {
  if (lines.length === 0) return;
  const rows = lines.map((entry) => ({ brand_id: who.brandId, project_id: who.projectId, role: entry.role, kind: entry.kind, body: entry.body, lines: entry.lines }));
  const { error } = await admin.from("assistant_messages").insert(rows);
  if (error) throw new Error("The conversation could not be kept.", { cause: error });
}
