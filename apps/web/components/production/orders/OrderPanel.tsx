/** W4 builds this panel. Until then it says what will be here. */
export function OrderPanel() {
  return (
    <section aria-labelledby="team-orders-heading" data-testid="team-orders-panel" className="flex flex-col gap-1">
      <h3 id="team-orders-heading" className="text-[15px] font-medium text-ink">Team orders</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">Names, numbers and sizes for a whole team will be added here.</p>
    </section>
  );
}
