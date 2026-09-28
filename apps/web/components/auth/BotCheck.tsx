"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";

type Turnstile = Readonly<{
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}>;

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

type BotCheckProps = Readonly<{
  siteKey: string;
  /** Change this to get a fresh check. A token works once, so do it after each submit. */
  attempt: number;
  /** Called with the attempt whose check has passed, or null when the token is lost. */
  onPassed: (attempt: number | null) => void;
  errors?: readonly string[];
}>;

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile. It adds a hidden field to the form it sits in. */
export function BotCheck({ siteKey, attempt, onPassed, errors = [] }: BotCheckProps) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile),
  );

  useEffect(() => {
    const turnstile = window.turnstile;
    if (!loaded || !turnstile || !container.current) return;
    const widgetId = turnstile.render(container.current, {
      sitekey: siteKey,
      theme: "light",
      "response-field-name": CAPTCHA_FIELD,
      callback: () => onPassed(attempt),
      "expired-callback": () => onPassed(null),
      "error-callback": () => onPassed(null),
    });
    return () => turnstile.remove(widgetId);
  }, [loaded, siteKey, attempt, onPassed]);

  return (
    <div className="flex flex-col gap-1.5">
      <Script src={SCRIPT} strategy="afterInteractive" onReady={() => setLoaded(true)} />
      <div ref={container} data-testid="bot-check" className="min-h-[65px]" />
      {errors.length > 0 ? (
        <p role="alert" className="text-sm text-warn">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
