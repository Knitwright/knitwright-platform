import type { ReactNode } from "react";

type Tone = "info" | "warn" | "ok";

type NoticeProps = Readonly<{
  tone?: Tone;
  /** "alert" interrupts a screen reader. Use it for errors the user must act on. */
  role?: "status" | "alert";
  children: ReactNode;
}>;

const TONES: Readonly<Record<Tone, string>> = {
  info: "bg-cobalt-wash text-ink-2",
  warn: "bg-warn-wash text-warn",
  ok: "bg-ok-wash text-ok",
};

export function Notice({ tone = "info", role = "status", children }: NoticeProps) {
  return (
    <div role={role} className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      {children}
    </div>
  );
}
