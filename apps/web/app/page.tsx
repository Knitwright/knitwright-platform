import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
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
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-5">
            <a
              href={`mailto:${PRODUCT.contactEmail}`}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              Contact
            </a>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-lg bg-cobalt px-3.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-hover"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-16">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Design studio</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          A spec a factory can build from.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Kit for your club, school or team, or clothing for your own brand. Describe a garment in plain
          words or start from a sketch. {PRODUCT.name} drafts the drawings, the graded measurements and the
          construction details, then helps you get it made.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <LinkButton href="/sign-up">Get started</LinkButton>
          <p className="text-sm text-muted">Sign-up is by invitation for now. You can ask for access.</p>
        </div>
        <div className="thread-line mt-10 max-w-xs rounded-full" aria-hidden="true" />

        <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">From an idea to a quote, in four steps</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.label} className="rounded-2xl border border-hairline bg-surface p-5">
              <span className="font-mono text-xs text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-base font-semibold text-ink">{step.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 text-sm text-muted">
          {PRODUCT.name}. {PRODUCT.tagline}.{" "}
          <Link href="/legal/terms" className="underline hover:text-ink">
            Terms
          </Link>{" "}
          <Link href="/legal/privacy" className="underline hover:text-ink">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  );
}
