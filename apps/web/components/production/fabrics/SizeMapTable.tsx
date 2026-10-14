import type { SizeLabelMap } from "@/lib/production/contract";
import { SizeMapRowForm } from "./FabricForms";

const SOURCE_WORDS: Readonly<Record<SizeLabelMap["source"], string>> = {
  suggested: "Suggested by Knitwright",
  "brand-supplied": "Set by your brand",
  "user-edited": "Typed in by you",
};

const CUT_WORDS: Readonly<Record<SizeLabelMap["cut"], string>> = {
  mens: "Men's cut",
  womens: "Women's cut",
  junior: "Junior cut",
  unisex: "Unisex cut",
};

/** Which pattern size each size label is cut from. Every row says whether it is only a suggestion. */
export function SizeMapTable({ maps }: Readonly<{ maps: readonly SizeLabelMap[] }>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
      <table className="w-full min-w-[40rem] text-left text-[15px]">
        <caption className="sr-only">Pattern size for each size label</caption>
        <thead>
          <tr className="border-b border-hairline text-sm text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Cut</th>
            <th scope="col" className="px-4 py-3 font-medium">Size label</th>
            <th scope="col" className="px-4 py-3 font-medium">Source</th>
            <th scope="col" className="px-4 py-3 font-medium">Cut from pattern size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {maps.map((entry) => (
            <tr key={`${entry.cut}-${entry.label}`}>
              <td className="px-4 py-3">{CUT_WORDS[entry.cut]}</td>
              <td className="px-4 py-3">{entry.label}</td>
              <td className="px-4 py-3 text-muted">{SOURCE_WORDS[entry.source]}</td>
              <td className="px-4 py-3">
                <SizeMapRowForm entry={entry} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
