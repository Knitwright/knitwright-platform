"use client";

import { History, MessageSquarePlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { AskAnswer } from "@/components/rulebook/ask/AskAnswer";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Inputs";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { routePrompt, TOKEN_NOTE, type HistoryEntry, type QuickStart } from "@/lib/ai-studio/agent";
import { BUYER_KINDS, type BuyerKind } from "@/lib/leads/buyer-kinds";
import { startGuidedAction } from "@/lib/projects/actions";
import { askRulebookAction } from "@/lib/rulebook/ask/actions";
import type { AskResult } from "@/lib/rulebook/ask/types";
import { AgentPrompt } from "./AgentPrompt";
import { AgentHistory } from "./AgentHistory";
import { ToneArt } from "./art";

/**
 * THE CREATIVE AGENT (`09` screen 2, prototype d09; decision 0141), built over what exists:
 * - a question goes to Ask (spec F-S5), whose answer only ever phrases rulebook entries, each with
 *   its "Why?" link; nothing a model wrote is shown unless Ask's grader passed it;
 * - anything else starts a design in the guided flow, which sends the words to the design chat
 *   (`ChatPanel`), where the design changes only through its parameters and layers.
 * History lists the conversations kept for the brand's designs; New chat clears this page.
 */

type Exchange = Readonly<{ said: string; answer: AskResult }>;

type Props = Readonly<{
  brandName: string;
  initialKind: BuyerKind | "";
  quickStarts: readonly QuickStart[];
  history: readonly HistoryEntry[];
  /** Words handed over from the AI Workflows hero, sent as soon as the page opens. */
  say: string;
  sketch: boolean;
}>;

function useAgent(initialKind: BuyerKind | "") {
  const toast = useToast();
  const [kind, setKind] = useState<BuyerKind | "">(initialKind);
  const [exchanges, setExchanges] = useState<readonly Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const start = async (body: Readonly<Record<string, string>>): Promise<void> => {
    if (kind === "") return setProblem("Choose which path fits you first.");
    setPending(true);
    // On success the action sends the browser to the design's guide, where the words go to the chat.
    const reply = await startGuidedAction({ buyerKind: kind, ...body });
    setPending(false);
    if (reply && !reply.success) setProblem(reply.error.message);
  };
  const ask = async (said: string): Promise<void> => {
    setPending(true);
    const reply = await askRulebookAction({ question: said });
    setPending(false);
    if (!reply.success) return void toast.show({ tone: "error", title: "That question was not answered", body: reply.error.message });
    setExchanges((now) => [...now, { said, answer: reply.data }]);
  };
  const send = async (said: string): Promise<void> => {
    setProblem(null);
    if (said.trim() === "") return;
    return routePrompt(said) === "ask" ? ask(said.trim()) : start({ method: "text", sentence: said.trim() });
  };
  return { kind, setKind, exchanges, setExchanges, pending, problem, send, attach: () => start({ method: "sketch" }) };
}

export function CreativeAgent({ brandName, initialKind, quickStarts, history, say, sketch }: Props) {
  const agent = useAgent(initialKind);
  const [words, setWords] = useState(say);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="studio-grid flex flex-col gap-10 rounded-3xl px-6 pt-6 pb-16 md:px-9">
      <div className="flex items-center gap-2">
        <Button variant="ghost" icon={<Icon icon={History} />} aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
          History
        </Button>
        <Button variant="ghost" icon={<Icon icon={MessageSquarePlus} />} onClick={() => { agent.setExchanges([]); setWords(""); }}>
          New chat
        </Button>
      </div>
      {showHistory ? <AgentHistory entries={history} /> : null}

      <section aria-labelledby="agent-heading" className="mx-auto flex w-full max-w-285 flex-col items-center gap-4 text-center">
        <h1 id="agent-heading" className="text-display text-text">
          What do you want to create today?
        </h1>
        <p className="text-h3 font-medium text-text-2">Your sportswear design agent: describe a kit, a drop or a campaign and it builds it with you.</p>
        {agent.kind === "" ? (
          <label className="flex items-center gap-3 text-body text-text-2">
            Which path fits you?
            <Select value="" onChange={(event) => agent.setKind(event.target.value as BuyerKind)} className="w-56">
              <option value="">Choose one</option>
              {BUYER_KINDS.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <AgentPrompt value={words} onChange={setWords} onSend={() => void agent.send(words)} onAttach={() => void agent.attach()} brandName={brandName} pending={agent.pending} />
        <p className="text-body text-muted">
          {TOKEN_NOTE}{" "}
          <Link href={"/credits" as Route} className="font-semibold text-text">
            Learn more
          </Link>
        </p>
        {sketch ? <Notice>Press + to start from a sketch or photo. You see what was read and tick each point before anything changes.</Notice> : null}
        {agent.problem ? <Notice tone="warn" role="alert">{agent.problem}</Notice> : null}
      </section>

      {agent.exchanges.length > 0 ? (
        <section aria-label="Answers" aria-live="polite" className="mx-auto flex w-full max-w-285 flex-col gap-6">
          {agent.exchanges.map((exchange, index) => (
            <article key={index} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-5">
              <p className="self-end rounded-xl bg-soft px-4 py-2 text-body text-text">{exchange.said}</p>
              <AskAnswer result={exchange.answer} />
            </article>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="quick-heading" className="flex flex-col gap-4">
        <h2 id="quick-heading" className="text-title text-text">
          Quick-start a project
        </h2>
        <ul className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {quickStarts.map((tile) => (
            <li key={tile.id}>
              <Link href={tile.href as Route} className="group flex flex-col gap-2 text-text no-underline">
                <ToneArt tone={tile.tone} className="aspect-4/3 live:group-hover:shadow-e2">
                  <span className="absolute bottom-4 left-4 text-h3 text-on-dark drop-shadow">{tile.label}</span>
                </ToneArt>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
