"use client";

import { ArrowUp, CloudUpload, ImagePlus, Mic, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MAX_PROMPT_LENGTH, agentAddress } from "@/lib/ai-studio/agent-address";

/**
 * The "Ask Creative Agent" card of the AI Workflows hero (`09` screen 3, prototype d07): an upload
 * tile, the words, + and add-image, the microphone and send. It hands the words to the Creative Agent
 * page, which answers or starts the design there; nothing is sent from here.
 *
 * The microphone is shown and disabled with its reason (10 §8): no voice input is wired yet.
 */

const MIC_REASON = "Voice input is not available yet. Type your idea instead.";

export function AskAgentCard() {
  const router = useRouter();
  const id = useId();
  const [words, setWords] = useState("");
  const send = () => {
    if (words.trim() !== "") router.push(agentAddress({ say: words }) as Route);
  };

  return (
    <form
      className="flex w-full max-w-225 flex-col gap-4 rounded-2xl border border-border bg-bg p-5 shadow-e2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Link
        href={agentAddress({ from: "sketch" }) as Route}
        aria-label="Upload a sketch or photo to start from"
        className="grid size-18 place-items-center rounded-xl border border-border text-muted no-underline live:hover:bg-soft"
      >
        <Icon icon={CloudUpload} />
      </Link>
      <label htmlFor={id} className="sr-only">
        Ask Creative Agent
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={MAX_PROMPT_LENGTH}
        value={words}
        placeholder="Ask Creative Agent"
        onChange={(event) => setWords(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        className="w-full resize-none bg-transparent text-body-lg text-text outline-none placeholder:text-muted-2"
      />
      <div className="flex items-center gap-2">
        <Link href={agentAddress({ from: "sketch" }) as Route} aria-label="Attach a file" className="grid size-10 place-items-center rounded-md text-text-2 live:hover:bg-soft">
          <Icon icon={Plus} />
        </Link>
        <Link href={"/ai-studio/image" as Route} aria-label="Make an image" className="grid size-10 place-items-center rounded-md text-text-2 live:hover:bg-soft">
          <Icon icon={ImagePlus} />
        </Link>
        <span className="flex-1" />
        <Button variant="ghost" iconOnly aria-label="Speak your idea" icon={<Icon icon={Mic} />} disabledReason={MIC_REASON} />
        <Button type="submit" variant="secondary" iconOnly aria-label="Send to Creative Agent" icon={<Icon icon={ArrowUp} />} disabled={words.trim() === ""} />
      </div>
    </form>
  );
}
