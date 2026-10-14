import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowMark } from "@/components/ui/ArrowMark";

/** The two ways to start a design. The guided way comes first and is the one primary action. */
const WAYS = [
  {
    id: "guided",
    href: "/studio/start",
    title: "Start a design",
    text: "Step by step, from your own words, a sketch or a garment, through to sharing it and a quote.",
    primary: true,
  },
  {
    id: "blank",
    href: "/studio/new",
    title: "Blank design",
    text: "Pick a garment and go straight to the full editor.",
    primary: false,
  },
] as const satisfies readonly { id: string; href: Route; title: string; text: string; primary: boolean }[];

/** The big glass panel at the top of the studio home, with the ways to start a design. */
export function StartWays({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <section aria-labelledby="start" className="glass flex h-full flex-col rounded-[2rem] p-6 sm:rounded-[2.5rem] sm:p-10">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{brandName}</p>
      <h1 id="start" className="mt-4 text-4xl font-medium leading-none tracking-[-0.04em] text-ink sm:text-6xl">
        Start your next kit.
        <br />
        <span className="morph-reveal thread-text pb-[0.08em]">Two ways in.</span>
      </h1>
      <ul className="mt-8 grid gap-3 sm:mt-auto sm:grid-cols-2 sm:pt-8">
        {WAYS.map((way, index) => (
          <li key={way.href} className="rise" style={{ "--i": index + 2 } as CSSProperties}>
            <div
              className={`lift flex min-h-36 flex-col gap-4 rounded-[1.6rem] border border-white/12 p-5 text-ink ${
                way.primary ? "thread-ring bg-white/[0.08]" : "bg-white/5"
              }`}
            >
              <span className="fill-layer" aria-hidden="true" />
              <span className="flex items-center justify-between gap-4">
                {/* The link covers the whole card; its name is the title alone. */}
                <Link
                  href={way.href}
                  aria-describedby={`way-${way.id}`}
                  className="text-lg font-medium tracking-[-0.01em] text-ink no-underline after:absolute after:inset-0 after:rounded-[1.6rem] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-cobalt-soft"
                >
                  {way.title}
                </Link>
                <span className={`chip-disc size-9 ${way.primary ? "" : "bg-white"}`} aria-hidden="true">
                  <ArrowMark />
                </span>
              </span>
              <span id={`way-${way.id}`} className="mt-auto text-[13.5px] leading-relaxed text-ink-2">
                {way.text}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
