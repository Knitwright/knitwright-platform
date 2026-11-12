import type { ReactNode } from "react";

type Tone = "info" | "warn" | "ok";

type NoticeProps = Readonly<{
  tone?: Tone;
  /** "alert" interrupts a screen reader. Use it for errors the user must act on. */
  role?: "status" | "alert";
  children: ReactNode;
}>;

const TONES: Readonly<Record<Tone, string>> = {
  info: "border-info/25 bg-info-soft text-text-2",
  warn: "border-warn/25 bg-warn-soft text-warn",
  ok: "border-ok/25 bg-ok-soft text-ok",
};

export function Notice({ tone = "info", role = "status", children }: NoticeProps) {
  return (
    <div
      role={role}
      className={`rounded-lg border px-4 py-3 text-body ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
