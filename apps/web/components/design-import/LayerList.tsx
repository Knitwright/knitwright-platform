import type { LayerRow } from "@/lib/design-import/view-model";
import { ReplaceMark } from "./ReplaceMark";

type Props = Readonly<{
  rows: readonly LayerRow[];
  ticked: ReadonlySet<string>;
  disabled: boolean;
  onTick: (id: string, on: boolean) => void;
  /** Replaces a redrawn crest, sponsor or badge with the person's own file. Without it the button is not shown. */
  onReplace?: (id: string, file: File, rights: boolean) => Promise<string | null>;
}>;

const LEVEL_TEXT: Readonly<Record<LayerRow["level"], string>> = {
  high: "text-ok",
  medium: "text-ink-2",
  low: "text-warn",
};

/** Every layer of the reading with how sure we are of it, in words and a number, and a box to accept it. */
export function LayerList({ rows, ticked, disabled, onTick, onReplace }: Props) {
  return (
    <ul className="flex flex-col gap-2" data-testid="design-import-layers">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-hairline bg-surface p-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-4" checked={ticked.has(row.id)} disabled={disabled} onChange={(event) => onTick(row.id, event.target.checked)} />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium text-ink">{row.label}</span>
              <span className={`text-sm ${LEVEL_TEXT[row.level]}`} data-testid={`confidence-${row.id}`}>
                How sure we are: {row.confidenceWords}
              </span>
              {row.note ? <span className="text-sm text-muted">{row.note}</span> : null}
              {row.needsOwnFile ? <span className="text-sm text-warn">Replace with your own file before this is printed.</span> : null}
            </span>
          </label>
          {row.needsOwnFile && onReplace ? (
            <div className="mt-2 pl-7">
              <ReplaceMark layerLabel={row.label} disabled={disabled} onReplace={(file, rights) => onReplace(row.id, file, rights)} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
