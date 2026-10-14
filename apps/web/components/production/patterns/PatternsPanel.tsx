/** W1 builds this panel. Until then it says what will be here. */
export function PatternsPanel() {
  return (
    <section aria-labelledby="patterns-heading" data-testid="patterns-panel" className="flex flex-col gap-1">
      <h3 id="patterns-heading" className="text-[15px] font-medium text-ink">Patterns</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">Patterns for this garment will be listed here, one for each size.</p>
    </section>
  );
}
