import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { CUT_CHOICES, type Context, type Cut, type Issue, type Row } from "./types";

type Props = Readonly<{
  rows: readonly Row[];
  context: Context;
  issues: readonly Issue[];
  onChange: (rows: readonly Row[]) => void;
}>;

const CELL = `${FIELD_CONTROL} h-9 w-full px-2 text-[14px]`;

/** The team list as a table of fields. Every cell says what it is for a screen reader. */
export function RosterTable({ rows, context, issues, onChange }: Props) {
  const set = (at: number, patch: Partial<Row>) => onChange(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)));
  const flagged = new Set(issues.filter((i) => i.severity === "error").map((i) => i.row));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left text-[13px]">
        <thead className="text-muted">
          <tr>
            <th className="w-10 font-normal">Row</th>
            {context.hasNamePlace ? <th className="font-normal">Name</th> : null}
            <th className="w-20 font-normal">Number</th>
            <th className="w-28 font-normal">Size</th>
            <th className="w-28 font-normal">Cut</th>
            <th className="w-20 font-normal">Shirts</th>
            <th className="w-16 font-normal"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, at) => (
            <tr key={at} data-flagged={flagged.has(at + 1) || undefined}>
              <td className={flagged.has(at + 1) ? "text-warn" : "text-muted"}>{at + 1}</td>
              {context.hasNamePlace ? (
                <td>
                  <input aria-label={`Name, row ${at + 1}`} className={CELL} value={row.name} maxLength={40} onChange={(e) => set(at, { name: e.target.value })} />
                </td>
              ) : null}
              <td>
                <input aria-label={`Number, row ${at + 1}`} className={CELL} inputMode="numeric" value={row.number} maxLength={3} onChange={(e) => set(at, { number: e.target.value })} />
              </td>
              <td>
                <input aria-label={`Size, row ${at + 1}`} className={CELL} list="roster-sizes" value={row.sizeLabel} maxLength={16} onChange={(e) => set(at, { sizeLabel: e.target.value })} />
              </td>
              <td>
                <select aria-label={`Cut, row ${at + 1}`} className={CELL} value={row.cut} onChange={(e) => set(at, { cut: e.target.value as Cut })}>
                  {CUT_CHOICES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </td>
              <td>
                <input aria-label={`Shirts, row ${at + 1}`} className={CELL} type="number" min={1} max={999} value={row.quantity} onChange={(e) => set(at, { quantity: Number(e.target.value) })} />
              </td>
              <td>
                <button type="button" className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => onChange(rows.filter((_, i) => i !== at))}>
                  Remove<span className="sr-only"> row {at + 1}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="roster-sizes">
        {context.run.map((size) => (
          <option key={size} value={size} />
        ))}
      </datalist>
    </div>
  );
}
