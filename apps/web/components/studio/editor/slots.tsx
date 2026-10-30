import { slotPlaceholder, type EditorSlotId } from "@/lib/editor";

/**
 * What the shell draws where a panel another workstream owns will go (the slot contract,
 * `lib/editor/slots.ts`). It says plainly which panel belongs here and who is building it, and
 * never stands in for the panel itself. The placeholders live here, in this workstream's own file,
 * so nothing is written into a directory another workstream owns.
 */
export function SlotPlaceholder({ id }: Readonly<{ id: EditorSlotId }>) {
  const slot = slotPlaceholder(id);
  return (
    // A plain box, not a landmark: the canvas already has a region named after each view, and a
    // second landmark of the same name would be two places called one thing to a screen reader.
    <div
      data-testid={slot.testId}
      className="flex min-h-24 flex-col justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-tile-2/90 p-4"
    >
      <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">{slot.title}</h3>
      <p className="text-[13px] leading-relaxed text-chalk-muted">{slot.note}</p>
      <p className="text-[13px] font-medium text-ink">Not built yet.</p>
    </div>
  );
}
