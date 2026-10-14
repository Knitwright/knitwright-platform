/** W2 builds this panel. Until then it says what will be here. */
export function FabricPanel() {
  return (
    <section aria-labelledby="fabrics-heading" data-testid="fabrics-panel" className="flex flex-col gap-1">
      <h3 id="fabrics-heading" className="text-[15px] font-medium text-ink">Fabrics</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">Your base fabrics and their stretch and shrink will be listed here.</p>
    </section>
  );
}
