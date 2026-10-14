import Link from "next/link";
import type { CSSProperties } from "react";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { LinkButton } from "@/components/ui/LinkButton";
import { PRODUCT } from "@/lib/config/product";

const STEPS = [
  {
    label: "Design",
    body: "Say what you want to make, upload a sketch or pick a garment. Change the fit, colours and logos.",
  },
  {
    label: "Committee vote",
    body: "Send your club or team committee a link. They see the design and vote, no account needed.",
  },
  {
    label: "Factory pack",
    body: "Get the tech pack a factory works from, as PDF, Excel and drawings, with graded measurements.",
  },
  {
    label: "Quote",
    body: "Tell us how many and by when, and the Knitwright team replies with a price.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <PublicHeader>
        <nav aria-label="Account" className="flex flex-wrap items-center gap-1">
          <a href={`mailto:${PRODUCT.contactEmail}`} className="nav-pill rounded-full px-4 py-2 text-sm text-muted">
            Contact
          </a>
          <Link href="/sign-in" className="nav-pill rounded-full px-4 py-2 text-sm font-medium text-ink">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="chip-btn rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-medium text-ink"
          >
            Get started
          </Link>
        </nav>
      </PublicHeader>

      <main id="main" className={`${pageFrame("content")} flex-1 py-16 sm:py-24`}>
        <p className="rise font-mono text-xs uppercase tracking-[0.1em] text-muted">Design studio</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-ink sm:text-7xl">
          A spec a factory <span className="morph-reveal thread-text pb-[0.08em]">can build from.</span>
        </h1>
        <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-ink-2" style={{ "--i": 3 } as CSSProperties}>
          Kit for your club, school or team, or clothing for your own brand. Describe a garment in plain
          words or start from a sketch. {PRODUCT.name} drafts the drawings, the graded measurements and the
          construction details, then helps you get it made.
        </p>
        <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ "--i": 4 } as CSSProperties}>
          <LinkButton href="/sign-up" arrow>
            Get started
          </LinkButton>
          <p className="text-sm text-muted">Sign-up is by invitation for now. You can ask for access.</p>
        </div>

        <h2 className="rise mt-16 text-2xl font-medium tracking-[-0.02em] text-ink" style={{ "--i": 5 } as CSSProperties}>
          From an idea to a quote, in four steps
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className="glass rise rounded-[1.75rem] p-6"
              style={{ "--i": index + 6 } as CSSProperties}
            >
              <span className="font-mono text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-lg font-medium tracking-[-0.01em] text-ink">{step.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-hairline">
        <div className={`${pageFrame("content")} flex flex-wrap gap-x-4 gap-y-1 py-6 text-sm text-muted`}>
          <span>
            {PRODUCT.name}. {PRODUCT.tagline}.
          </span>
          <Link href="/legal/terms" className="soft-link underline underline-offset-4 hover:text-ink">
            Terms
          </Link>
          <Link href="/legal/privacy" className="soft-link underline underline-offset-4 hover:text-ink">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  );
}
