import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/PageStates";
import type { HistoryEntry } from "@/lib/ai-studio/agent";
import { garmentEditorHref } from "@/lib/canvas/address";

/**
 * The Creative Agent's History: the conversations kept for the brand's designs (decision 0141), one
 * per design, newest first. Each opens the design, where the conversation continues.
 */
export function AgentHistory({ entries }: Readonly<{ entries: readonly HistoryEntry[] }>) {
  if (entries.length === 0) {
    return (
      <EmptyState icon={<Icon icon={MessagesSquare} size={22} />} title="No conversations yet">
        Describe a kit below. Each design keeps its own conversation, and it shows here.
      </EmptyState>
    );
  }
  return (
    <nav aria-label="Conversation history" className="rounded-2xl border border-border bg-bg p-2">
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.projectId}>
            <Link href={garmentEditorHref(entry.projectId)} className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-text no-underline live:hover:bg-soft">
              <span className="text-body font-semibold">{entry.projectName}</span>
              <span className="text-small text-muted">{entry.said}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
