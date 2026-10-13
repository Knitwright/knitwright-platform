import Link from "next/link";
import type { CSSProperties } from "react";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { PRODUCT } from "@/lib/config/product";

const STEPS = [
  {
    label: "Describe",
    body: "Say what you want to make, or upload a sketch.",
  },
  {
    label: "Adjust",
    body: "Change the fit, the sleeve or the colours. Every number moves with it.",
  },
  {
    label: "Download",
    body: "Take the tech pack to your factory as PDF, Excel and drawings.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <PublicHeader>
        <nav aria-label="Account" className="flex items-center gap-1">
          <a href={`mailto:${PRODUCT.contactEmail}`} className="nav-pill rounded-full px-4 py-2 text-sm text-muted">
            Contact
          </a>
          <Link href="/sign-in" className="nav-pill rounded-full px-4 py-2 text-sm font-medium text-ink">
            Sign in
          </Link>
        </nav>
      </PublicHeader>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-16 sm:py-24">
        <p className="rise font-mono text-xs uppercase tracking-[0.1em] text-muted">Design studio</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-ink sm:text-7xl">
          A spec a factory <span className="morph-reveal thread-text pb-[0.08em]">can build from.</span>
        </h1>
        <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-ink-2" style={{ "--i": 3 } as CSSProperties}>
          Describe a garment in plain words or start from a sketch. {PRODUCT.name} drafts the
          drawings, the graded measurements and the construction details.
        </p>
        <div className="rise mt-9" style={{ "--i": 4 } as CSSProperties}>
          <LinkButton href="/sign-up" arrow>
            Start a design
          </LinkButton>
        </div>

        <ol className="mt-16 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className="glass rise rounded-[1.75rem] p-6"
              style={{ "--i": index + 5 } as CSSProperties}
            >
              <span className="font-mono text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 text-lg font-medium tracking-[-0.01em] text-ink">{step.label}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-4 gap-y-1 px-5 py-6 text-sm text-muted">
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
