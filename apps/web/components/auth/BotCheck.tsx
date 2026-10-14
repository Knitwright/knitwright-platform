"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { botCheckStatus, type BotCheckStatus } from "@/lib/forms/bot-check-status";

type Turnstile = Readonly<{
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}>;

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Widget = Readonly<{
  attempt: number;
  status: BotCheckStatus;
  onPassed: (attempt: number | null) => void;
  onFailed: () => void;
}>;

/**
 * Keeps track of the bot check for a form. `guard` goes on the form's onSubmit: it
 * holds the form back, and says why, when the check has not passed yet.
 */
export const useBotCheck = (attempt: number) => {
  const [passedAttempt, setPassedAttempt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [askedEarlyAt, setAskedEarlyAt] = useState<number | null>(null);

  const status = botCheckStatus({
    attempt,
    passedAttempt,
    failed,
    askedEarly: askedEarlyAt === attempt,
  });

  const onPassed = useCallback((passed: number | null) => {
    setPassedAttempt(passed);
    if (passed !== null) setFailed(false);
  }, []);
  const onFailed = useCallback(() => setFailed(true), []);

  const guard = (event: FormEvent<HTMLFormElement>) => {
    if (status.ready) return;
    event.preventDefault();
    setAskedEarlyAt(attempt);
  };

  const widget: Widget = { attempt, status, onPassed, onFailed };
  return { guard, widget };
};

type BotCheckProps = Readonly<{
  siteKey: string;
  widget: Widget;
  /** What the server said about the check, if it refused it. */
  errors?: readonly string[];
}>;

/** Cloudflare Turnstile. It adds a hidden field to the form it sits in. */
export function BotCheck({ siteKey, widget, errors = [] }: BotCheckProps) {
  const { attempt, status, onPassed, onFailed } = widget;
  const container = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const [loaded, setLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile),
  );

  useEffect(() => {
    const turnstile = window.turnstile;
    if (!loaded || !turnstile || !container.current) return;
    const widgetId = turnstile.render(container.current, {
      sitekey: siteKey,
      theme: "dark",
      "response-field-name": CAPTCHA_FIELD,
      callback: () => onPassed(attempt),
      "expired-callback": () => onPassed(null),
      "error-callback": onFailed,
    });
    return () => turnstile.remove(widgetId);
  }, [loaded, siteKey, attempt, onPassed, onFailed]);

  const messages = [...errors, ...(status.message ? [status.message] : [])];
  const urgent = errors.length > 0 || status.tone === "warn";

  return (
    <div className="flex flex-col gap-1.5" data-bot-check={status.ready ? "ready" : "waiting"}>
      {/*
        A page can hold two bot checks, such as the sign-up page with its access request.
        next/script loads the script once, and a second copy that mounts while it is still
        loading only gets onLoad, never onReady. onReady covers a copy that mounts after
        the script has loaded. Both are needed, or the second check never starts.
      */}
      <Script
        src={SCRIPT}
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onReady={() => setLoaded(true)}
        onError={onFailed}
      />
      <div ref={container} className="min-h-[65px]" aria-describedby={messageId} />
      <p
        id={messageId}
        role={urgent ? "alert" : "status"}
        className={`min-h-5 text-sm ${urgent ? "text-warn" : "text-muted"}`}
      >
        {messages.join(" ")}
      </p>
    </div>
  );
}
