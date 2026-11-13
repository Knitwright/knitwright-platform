"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { freePlace } from "@/components/launch/placing";
import { useToast } from "@/components/ui/Toast";
import { agentAddress } from "@/lib/ai-studio/agent-address";
import { routePrompt } from "@/lib/ai-studio/agent";
import { runFlowAction } from "@/lib/flows/actions";
import { connectLaunchBoardsAction, saveBoardAction } from "@/lib/launch/actions";
import type { BoardView, Graph } from "@/lib/launch";
import { refusedToast, runToast, unreachedToast, type GenerationPlan, type NewBoard, type ToastWords } from "@/lib/prompt-bar";
import { askRulebookAction } from "@/lib/rulebook/ask/actions";
import type { AskResult } from "@/lib/rulebook/ask/types";

/**
 * What Send does (decision 0149), through the actions the rest of the canvas already uses: the launch
 * shell's `saveBoardAction` and `connectLaunchBoardsAction` to add or re-settings a board, then
 * `runFlowAction` -- the run engine that shows the cost first, charges through the credit ledger,
 * refunds a failed board and keeps the garment lock (decision 0133). Ask goes to `askRulebookAction`;
 * Agentic sends a request to the Creative Agent. The toast says what really happened, money included.
 */

type Reply<T> = Readonly<{ success: true; data: T }> | Readonly<{ success: false; error: Readonly<{ message: string }> }>;

class Refused extends Error {}

const unwrap = <T>(reply: Reply<T> | null | undefined): T => {
  if (!reply) throw new Error("unreached");
  if (!reply.success) throw new Refused(reply.error.message);
  return reply.data;
};

const fieldsOf = (board: BoardView) => ({ name: board.name, x: board.at.x, y: board.at.y, width: board.size.width, height: board.size.height, inputVersion: board.inputVersion });

export type Exchange = Readonly<{ said: string; answer: AskResult }>;

export function usePromptSend(launchProjectId: string, graph: Graph) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [exchanges, setExchanges] = useState<readonly Exchange[]>([]);

  const say = (words: ToastWords, retry?: () => void): void =>
    void toast.show({ ...words, action: retry && words.tone === "error" ? { label: "Retry", onAction: retry } : undefined });

  /** Adds the plan's boards, connected, and answers with the id of the board the run starts from. */
  const addBoards = async (boards: readonly NewBoard[], runKey: string): Promise<string> => {
    const ids = new Map<string, string>();
    let placed = graph.boards;
    for (const board of boards) {
      const at = freePlace(placed, board.at);
      const added = unwrap(
        await saveBoardAction({ launchProjectId, boardId: null, kind: board.kind, name: board.name, x: at.x, y: at.y, width: board.size.width, height: board.size.height, settings: { ...board.settings }, inputVersion: null }).catch(() => null),
      );
      ids.set(board.key, added.id);
      // Only the place is read by `freePlace`, so the next board does not land on this one.
      placed = [...placed, { at } as BoardView];
      for (const feed of board.feeds) {
        unwrap(await connectLaunchBoardsAction({ launchProjectId, fromBoardId: ids.get(feed.from) ?? feed.from, toBoardId: added.id, inputIndex: feed.inputIndex }).catch(() => null));
      }
    }
    return ids.get(runKey) as string;
  };

  const run = async (boardId: string, scope: "board" | "downstream", shownCredits: number, what: "image" | "video"): Promise<void> => {
    try {
      const reply = unwrap(await runFlowAction({ launchProjectId, boardId, scope, shownCredits }).catch(() => null));
      say(runToast(reply, what), () => void run(boardId, scope, shownCredits, what));
    } catch (error) {
      say(error instanceof Refused ? refusedToast(error.message) : unreachedToast(), () => void run(boardId, scope, shownCredits, what));
    }
  };

  const generate = async (plan: Extract<GenerationPlan, { ok: true }>, shownCredits: number, what: "image" | "video"): Promise<boolean> => {
    setPending(true);
    try {
      let boardId: string;
      let scope: "board" | "downstream" = "board";
      if (plan.action === "edit") {
        unwrap(await saveBoardAction({ launchProjectId, boardId: plan.board.id, kind: plan.board.kind, ...fieldsOf(plan.board), settings: { ...plan.settings } }).catch(() => null));
        boardId = plan.board.id;
      } else {
        boardId = await addBoards(plan.boards, plan.runKey);
        scope = plan.scope;
      }
      await run(boardId, scope, shownCredits, what);
      return true;
    } catch (error) {
      say(error instanceof Refused ? refusedToast(error.message) : unreachedToast());
      return false;
    } finally {
      setPending(false);
      router.refresh();
    }
  };

  const ask = async (question: string): Promise<void> => {
    setPending(true);
    const reply = await askRulebookAction({ question }).catch(() => null);
    setPending(false);
    if (!reply) return say({ tone: "error", title: "That question was not answered", body: "Check your connection and try again." });
    if (!reply.success) return say({ tone: "error", title: "That question was not answered", body: reply.error.message });
    setExchanges((now) => [...now, { said: question, answer: reply.data }]);
  };

  /** Agentic (Beta): a question is answered here; anything else opens the Creative Agent with the words. */
  const agent = async (words: string): Promise<void> => {
    if (routePrompt(words) === "ask") return ask(words);
    router.push(agentAddress({ say: words }) as Route);
  };

  return { pending, exchanges, clearExchanges: () => setExchanges([]), generate, ask, agent };
}
