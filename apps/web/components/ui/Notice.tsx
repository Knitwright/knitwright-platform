import type { ReactNode } from "react";

type Tone = "info" | "warn" | "ok";

type NoticeProps = Readonly<{
  tone?: Tone;
  /** "alert" interrupts a screen reader. Use it for errors the user must act on. */
  role?: "status" | "alert";
  children: ReactNode;
}>;

const TONES: Readonly<Record<Tone, string>> = {
  info: "border-cobalt-soft/30 bg-cobalt-wash text-ink-2",
  warn: "border-warn/30 bg-warn-wash text-warn",
  ok: "border-ok/30 bg-ok-wash text-ok",
};

export function Notice({ tone = "info", role = "status", children }: NoticeProps) {
  return (
    <div
      role={role}
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
