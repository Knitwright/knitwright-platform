import type { Metadata } from "next";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Studio</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Your designs</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
        You are signed in. Designs will appear here once the editor is ready.
      </p>
    </>
  );
}
