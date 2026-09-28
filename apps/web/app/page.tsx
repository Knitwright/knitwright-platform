import { Logo } from "@/components/brand/Logo";
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
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
          <Logo />
          <a
            href={`mailto:${PRODUCT.contactEmail}`}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Contact
          </a>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-16">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Design studio</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          A spec a factory can build from.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Describe a garment in plain words or start from a sketch. {PRODUCT.name} drafts the
          drawings, the graded measurements and the construction details.
        </p>
        <div className="thread-line mt-10 max-w-xs rounded-full" aria-hidden="true" />

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.label} className="rounded-2xl border border-hairline bg-surface p-5">
              <span className="font-mono text-xs text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 text-base font-semibold text-ink">{step.label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 text-sm text-muted">
          {PRODUCT.name}. {PRODUCT.tagline}.
        </div>
      </footer>
    </>
  );
}
