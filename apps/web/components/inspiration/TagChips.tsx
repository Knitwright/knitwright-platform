import type { TagChip } from "@/lib/inspiration/view";
import { listProps, pinTagProps, removeTagProps } from "./a11y";

type Props = Readonly<{
  tags: readonly TagChip[];
  onPin?: (text: string, pinned: boolean) => void;
  onRemove?: (text: string) => void;
}>;

/** The context query's tags, each with where it came from, and the two ways to steer it (spec F-S1). */
export function TagChips({ tags, onPin, onRemove }: Props) {
  if (tags.length === 0) return <p className="text-xs text-muted">No tags yet. The board follows the design as you make it.</p>;
  return (
    <ul {...listProps("The tags the board is searching with")} className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag.text} role="listitem" className="glass flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" data-testid="inspiration-tag">
          <span className="font-medium text-ink">{tag.text}</span>
          <span className="text-[0.65rem] text-muted">{tag.kindLabel}</span>
          <button {...pinTagProps(tag.text, tag.pinned)} onClick={() => onPin?.(tag.text, tag.pinned)} className="soft-link">
            {tag.pinned ? "Unpin" : "Pin"}
          </button>
          <button {...removeTagProps(tag.text)} onClick={() => onRemove?.(tag.text)} className="soft-link">
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
