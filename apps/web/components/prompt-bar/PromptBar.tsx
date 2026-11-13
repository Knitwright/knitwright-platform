"use client";

import { ArrowRight, ArrowUp, Film, Image as ImageIcon, Lock, Mic, Shirt, Wand2, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useCanvas } from "@/components/canvas/CanvasStore";
import { AskAnswer } from "@/components/rulebook/ask/AskAnswer";
import { cx } from "@/components/ui/cx";
import { Icon, Spinner } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { boardFilePath } from "@/lib/flows/task-actions";
import { BOARDS, isGarmentKind, type BoardView, type LaunchCostSource, type LaunchProjectView } from "@/lib/launch";
import {
  cardOf,
  DEFAULT_CHOICES,
  editedBoard,
  enhance,
  estimatePlan,
  historyOf,
  imageModelCards,
  MAX_PROMPT_WORDS,
  MODES,
  planGeneration,
  presetsFor,
  referenceOf,
  sendLabel,
  videoModelCards,
  withPicks,
  type PromptChoices,
} from "@/lib/prompt-bar";
import { BrowseStylesModal } from "./BrowseStylesModal";
import { ImageMenus, ModelMenu, ModeMenu, PlusMenu, VideoMenus } from "./PromptControls";
import { PromptBuilderModal } from "./PromptBuilderModal";
import { PromptsModal } from "./PromptsModal";
import { usePromptSend } from "./usePromptSend";

/**
 * THE PROMPT BAR (plan v6 E5, decision 0149; `08` §5.1, §5.6, v3.2–v3.4 "Prompt bar"; `10` "Prompt bar":
 * max 720 px, 18 px radius, e2, centred above the dock; prototype e34).
 *
 * Collapsed, a wide rounded box reading "Describe image you want to create". Open (a click, or focus),
 * the references row -- the board a new one is fed from, numbered, with the 🔒 garment lock, then →,
 * then a light-blue tile of what will be made -- the prompt, and the footer: + · mode | model · aspect
 * · count · ⋯ … wand · mic · send. With an AI board selected it edits that board ("Edit AI Image
 * board ×"). The cost is on the send button before anything is spent, and the toast afterwards says
 * what was spent and what was refunded. It reads the selection from the canvas store.
 */

export type PromptBarProps = Readonly<{
  project: LaunchProjectView;
  credits: number | null;
  costs: LaunchCostSource;
  /** False for a member who may look but not change the canvas. */
  canEdit: boolean;
  /** Where the bar starts: the /dev fixture opens it, a modal or a mode. Real pages leave it out. */
  initial?: Readonly<{ open?: boolean; modal?: "styles" | "builder" | "prompts"; choices?: Partial<PromptChoices> }>;
}>;

const promptOf = (board: BoardView): string => (typeof board.settings["prompt"] === "string" ? (board.settings["prompt"] as string) : "");

export function PromptBar({ project, credits, costs, canEdit, initial }: PromptBarProps) {
  const graph = useMemo(() => ({ boards: project.boards, edges: project.edges }), [project.boards, project.edges]);
  const selection = useCanvas((state) => state.selection);
  const [choices, setChoices] = useState<PromptChoices>({ ...DEFAULT_CHOICES, ...initial?.choices });
  const [open, setOpen] = useState(initial?.open ?? false);
  const [modal, setModal] = useState<"styles" | "builder" | "prompts" | null>(initial?.modal ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const promptId = useId();
  const send = usePromptSend(project.id, graph);
  const set = (patch: Partial<PromptChoices>) => {
    setProblem(null);
    setChoices((now) => ({ ...now, ...patch }));
  };

  const mode = choices.mode;
  const generating = mode === "image" || mode === "video";
  const edited = editedBoard(graph, selection, mode);
  const reference = generating ? referenceOf(graph, selection, mode) : null;

  // Selecting an AI board loads its own prompt, so editing starts from what the board holds. Done
  // while rendering, when the edited board changes, rather than in an effect (react.dev, "you might
  // not need an effect").
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if ((edited?.id ?? null) !== loadedFor) {
    setLoadedFor(edited?.id ?? null);
    if (edited) setChoices((now) => ({ ...now, prompt: promptOf(edited) }));
  }

  const cards = mode === "video" ? videoModelCards() : imageModelCards(costs);
  const model = cardOf(cards, mode === "video" ? choices.videoModelKey : null);
  const plan = generating ? planGeneration(graph, selection, { ...choices, videoModelKey: model?.key ?? null }) : null;
  const estimate = plan ? estimatePlan(graph, plan, costs) : null;
  const what = mode === "video" ? "video" : "image";
  const busy = send.pending || !canEdit;
  const words = choices.prompt.trim();

  const onSend = async (): Promise<void> => {
    setProblem(null);
    if (words === "") return setProblem("Describe what you want first.");
    if (mode === "ask") {
      await send.ask(words);
      return set({ prompt: "" });
    }
    if (mode === "agentic") return send.agent(words);
    if (plan === null || !plan.ok) return setProblem(plan?.reason ?? null);
    const cost = estimate?.credits ?? 0;
    if (credits !== null && cost > credits) return setProblem(`This costs ${cost} credits and your balance is ${credits}. Nothing has been spent.`);
    await send.generate(plan, cost, what);
  };

  return (
    <div
      ref={box}
      className="pointer-events-auto relative w-full max-w-180"
      onKeyDown={(event) => {
        if (event.key === "Escape" && modal === null && words === "") setOpen(false);
      }}
      data-testid="prompt-bar"
      data-mode={mode}
    >
      {send.exchanges.length > 0 ? (
        <section aria-label="Answers" aria-live="polite" className="mb-2 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-prompt border border-border bg-bg p-4 shadow-e2" data-testid="prompt-answers">
          <div className="flex items-center justify-between">
            <h2 className="text-title text-text">Ask Knitwright</h2>
            <button type="button" aria-label="Close answers" onClick={send.clearExchanges} className="grid size-8 place-items-center rounded-full live:hover:bg-soft">
              <Icon icon={X} size={16} />
            </button>
          </div>
          {send.exchanges.map((exchange, index) => (
            <article key={index} className="flex flex-col gap-2">
              <p className="self-end rounded-xl bg-soft px-3 py-1.5 text-body text-text">{exchange.said}</p>
              <AskAnswer result={exchange.answer} />
            </article>
          ))}
        </section>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          className="flex h-14 w-full items-center rounded-prompt border border-border bg-bg px-4.5 text-left text-body-lg font-normal text-muted shadow-e2"
          data-testid="prompt-collapsed"
        >
          {MODES[mode].placeholder}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-prompt border border-electric/40 bg-bg p-3.5 shadow-e2" data-testid="prompt-open">
          {edited ? (
            <div className="flex items-center justify-between text-body-lg font-semibold text-text">
              <span>Edit {BOARDS[edited.kind].label} board</span>
              <span className="text-small font-medium text-muted">{edited.name}</span>
            </div>
          ) : null}
          {generating ? <References reference={reference} mode={what} /> : null}
          <label htmlFor={promptId} className="sr-only">
            {MODES[mode].placeholder}
          </label>
          <textarea
            id={promptId}
            autoFocus
            rows={2}
            maxLength={MAX_PROMPT_WORDS}
            value={choices.prompt}
            disabled={busy}
            placeholder={MODES[mode].placeholder}
            onChange={(event) => set({ prompt: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSend();
              }
            }}
            className="min-h-12 w-full resize-none bg-transparent px-1 text-body-lg font-normal text-text outline-none placeholder:text-muted"
            data-testid="prompt-text"
          />
          {problem ? (
            <p role="alert" className="px-1 text-small text-bad-strong" data-testid="prompt-problem">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            {generating ? <PlusMenu disabled={busy} onOpen={setModal} /> : null}
            <ModeMenu mode={mode} set={set} />
            {generating ? (
              <>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <ModelMenu cards={cards} picked={model} onPick={(key) => (mode === "video" ? set({ videoModelKey: key }) : undefined)} />
                {mode === "video" ? <VideoMenus choices={choices} set={set} /> : <ImageMenus choices={choices} set={set} />}
              </>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              {generating ? (
                <Tooltip content="Enhance prompt: add the style's light and camera words">
                  <button type="button" aria-label="Enhance prompt" disabled={busy} onClick={() => set({ prompt: enhance(choices.prompt, choices.style) })} className="grid size-9 place-items-center rounded-full text-text-2 live:hover:bg-soft disabled:opacity-40" data-testid="prompt-enhance">
                    <Icon icon={Wand2} size={20} />
                  </button>
                </Tooltip>
              ) : null}
              <Tooltip content="Voice input is not available yet">
                <button type="button" aria-label="Voice input, not available yet" disabled className="grid size-9 place-items-center rounded-full text-text-2 disabled:opacity-40">
                  <Icon icon={Mic} size={20} />
                </button>
              </Tooltip>
              <Tooltip content={generating ? sendLabel(estimate, what) : MODES[mode].paid ? "Send" : "Send · no credits used"}>
                <button
                  type="button"
                  aria-label={generating ? sendLabel(estimate, what) : "Send"}
                  disabled={busy}
                  onClick={() => void onSend()}
                  className="grid size-11 place-items-center rounded-lg bg-navy text-on-dark transition-colors duration-fast live:hover:bg-navy-2 disabled:opacity-55"
                  data-testid="prompt-send"
                  data-credits={estimate?.credits ?? 0}
                >
                  {send.pending ? <Spinner size={20} /> : <Icon icon={ArrowUp} size={20} />}
                </button>
              </Tooltip>
            </span>
          </div>
          {!canEdit ? <p className="px-1 text-small text-muted">You can look at this canvas. Only owners, admins and kit managers can generate on it.</p> : null}
        </div>
      )}

      <BrowseStylesModal open={modal === "styles"} onClose={() => setModal(null)} style={choices.style} onPick={(style) => set({ style })} modelLabel={model?.label ?? "Standard"} />
      <PromptBuilderModal open={modal === "builder"} onClose={() => setModal(null)} onAdd={(picks) => set({ prompt: withPicks(choices.prompt, picks).slice(0, MAX_PROMPT_WORDS) })} />
      <PromptsModal open={modal === "prompts"} onClose={() => setModal(null)} history={historyOf(project.boards)} presets={presetsFor(mode)} onPick={(prompt) => set({ prompt })} />
    </div>
  );
}

/** The references row: the board a new one is fed from, →, and what will be made. */
function References({ reference, mode }: Readonly<{ reference: BoardView | null; mode: "image" | "video" }>) {
  return (
    <div className="flex items-center gap-3" data-testid="prompt-references">
      {reference ? (
        <div className="relative size-19 overflow-hidden rounded-lg bg-soft" title={`${reference.name || BOARDS[reference.kind].label} · garment locked`}>
          {reference.outputFileId ? (
            // A board's own output picture, served by the files route; never a remote address.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boardFilePath(reference.outputFileId)} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-navy">
              <Icon icon={isGarmentKind(reference.kind) ? Shirt : ImageIcon} size={22} />
            </span>
          )}
          <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-sm bg-text text-on-dark" aria-hidden="true">
            <Icon icon={Lock} size={14} />
          </span>
          <span className="absolute bottom-1 left-1.5 text-caption font-bold text-on-dark drop-shadow">1</span>
          <span className="sr-only">Reference 1: {reference.name || BOARDS[reference.kind].label}, garment locked</span>
        </div>
      ) : (
        <p className="text-small text-muted">No reference yet: add a garment board to the canvas.</p>
      )}
      <Icon icon={ArrowRight} size={20} className="text-text-2" />
      <span className={cx("grid size-19 place-items-center rounded-lg bg-electric-soft text-electric")} aria-label={mode === "video" ? "Makes a video" : "Makes an image"} role="img">
        <Icon icon={mode === "video" ? Film : ImageIcon} size={22} />
      </span>
    </div>
  );
}
