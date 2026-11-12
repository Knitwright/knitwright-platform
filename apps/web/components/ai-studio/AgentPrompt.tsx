"use client";

import { ArrowUp, Briefcase, Mic, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MAX_PROMPT_LENGTH } from "@/lib/ai-studio/agent-address";

/**
 * The Creative Agent's prompt card (`09` screen 2, prototype d09): the words, + (attach a sketch or
 * photo), the brand, the microphone and send. The microphone is visible and disabled with its
 * reason (10 §8) until voice input exists.
 */

type Props = Readonly<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  brandName: string;
  pending: boolean;
}>;

const MIC_REASON = "Voice input is not available yet. Type your idea instead.";

export function AgentPrompt({ value, onChange, onSend, onAttach, brandName, pending }: Props) {
  const id = useId();
  return (
    <form
      className="flex w-full flex-col gap-4 rounded-prompt border-4 border-gold-soft bg-bg p-5 shadow-e1"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Ask Creative Agent
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={MAX_PROMPT_LENGTH}
        value={value}
        placeholder="Ask Creative Agent… e.g. “Home and away kits for a navy-and-gold cricket club, retro 90s”"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        className="w-full resize-none bg-transparent text-body-lg text-text outline-none placeholder:text-muted-2"
      />
      <div className="flex items-center gap-2">
        <Button variant="ghost" iconOnly aria-label="Attach a sketch or photo" icon={<Icon icon={Plus} />} onClick={onAttach} disabled={pending} />
        <Link href={"/brand-studio" as Route} className="flex h-8 items-center gap-2 rounded-full bg-soft px-3 text-small font-semibold text-text-2 no-underline live:hover:bg-soft-2">
          <Icon icon={Briefcase} size={16} />
          {brandName} brand
        </Link>
        <span className="flex-1" />
        <Button variant="ghost" iconOnly aria-label="Speak your idea" icon={<Icon icon={Mic} />} disabledReason={MIC_REASON} />
        <Button type="submit" variant="secondary" iconOnly aria-label="Send" icon={<Icon icon={ArrowUp} />} pending={pending} disabled={value.trim() === ""} />
      </div>
    </form>
  );
}
