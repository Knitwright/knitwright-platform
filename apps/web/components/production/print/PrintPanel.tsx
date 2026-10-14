/** W3 builds this panel. Until then it says what will be here. */
export function PrintPanel() {
  return (
    <section aria-labelledby="print-files-heading" data-testid="print-files-panel" className="flex flex-col gap-1">
      <h3 id="print-files-heading" className="text-[15px] font-medium text-ink">Print files</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">Print files for every piece and size will be made here.</p>
    </section>
  );
}
