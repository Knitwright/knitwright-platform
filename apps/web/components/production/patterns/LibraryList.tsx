import { Button } from "@/components/ui/Button";
import { dxfAddress } from "@/lib/pattern-library/client";
import type { BlockView } from "@/lib/pattern-library/records";
import type { SlotState } from "@/lib/pattern-library/slots";

const WEARER_WORDS = { men: "Men's", women: "Women's", youth: "Youth" } as const;

const stateWords = (block: BlockView): string =>
  block.review
    ? `Reviewed by ${block.review.reviewerName} (${block.review.reviewerRole}) on ${block.review.reviewedOn}.`
    : "Draft pattern, not reviewed.";

function BlockRow({ block, onOpen }: Readonly<{ block: BlockView; onOpen: (id: string) => void }>) {
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-hairline p-3">
      <p className="text-sm text-ink">
        {WEARER_WORDS[block.wearer]}, version {block.version}
        {block.kind === "pieces" ? `, ${block.sizes.length} ${block.sizes.length === 1 ? "size" : "sizes"}` : ", knit programme"}
      </p>
      <p className="text-[13px] text-muted">
        {block.sources}. {stateWords(block)}
      </p>
      {block.questions.map((question) => (
        <p key={question} className="text-[13px] text-warn">
          {question}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {block.kind === "pieces" ? (
          <>
            <Button type="button" variant="secondary" onClick={() => onOpen(block.id)}>
              See the measurements
            </Button>
            <a className="soft-link inline-flex h-11 items-center text-[15px] text-ink" href={dxfAddress(block.id, "all")}>
              Download every size (DXF)
            </a>
          </>
        ) : (
          <p className="text-[13px] text-muted">Size map: {Object.entries(block.sizeMap ?? {}).map(([label, size]) => `${label} is ${size}`).join(", ")}</p>
        )}
      </div>
    </li>
  );
}

/** Every slot of the library, with the newest pattern of each wearer and cut, or why it is empty. */
export function LibraryList({ slots, onOpen }: Readonly<{ slots: readonly SlotState[]; onOpen: (blockId: string) => void }>) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Pattern library">
      {slots.map(({ slot, blocks, emptyText }) => (
        <li key={slot.productKey} className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-ink">{slot.label}</h4>
          {emptyText ? <p className="text-[13px] text-muted">{emptyText}</p> : null}
          {blocks.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {blocks.map((block) => (
                <BlockRow key={block.id} block={block} onOpen={onOpen} />
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
