"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { readBlock, readLibrary, type Library } from "@/lib/pattern-library/client";
import type { BlockDetail } from "@/lib/pattern-library/records";
import { BlockDetailView } from "./BlockDetailView";
import { LibraryList } from "./LibraryList";
import { UploadForm } from "./UploadForm";

/**
 * The pattern library: a slot for every product, what each holds, and the measured table of
 * the pattern opened. Each pattern is a draft until a named person has reviewed it, and the
 * panel says so beside every one.
 */
export function PatternsPanel() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [detail, setDetail] = useState<BlockDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof readLibrary>>) => {
    if (result.ok) {
      setLibrary(result.data);
      setProblem(null);
    } else setProblem(result.reason);
  }, []);

  const load = useCallback(async () => apply(await readLibrary()), [apply]);

  useEffect(() => {
    let live = true;
    // Read once when the panel opens, after the first paint.
    const timer = setTimeout(() => {
      void readLibrary().then((result) => {
        if (live) apply(result);
      });
    }, 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [apply]);

  const open = async (blockId: string) => {
    const result = await readBlock(blockId);
    if (result.ok) {
      setDetail(result.data);
      setProblem(null);
    } else setProblem(result.reason);
  };

  return (
    <section aria-labelledby="patterns-heading" data-testid="patterns-panel" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="patterns-heading" className="text-[15px] font-medium text-ink">
          Patterns
        </h3>
        <p className="text-[13px] leading-relaxed text-muted">
          The pieces to cut, for every size, with the measurements read from them. A pattern is a draft until a named person has reviewed it.
        </p>
      </div>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
      {library && !library.open ? <Notice>The pattern library is not open yet.</Notice> : null}
      {library?.open && !detail ? (
        <>
          <LibraryList slots={library.slots} onOpen={(id) => void open(id)} />
          <UploadForm slots={library.slots} onStored={() => void load()} />
        </>
      ) : null}
      {detail ? (
        <BlockDetailView
          detail={detail}
          onBack={() => setDetail(null)}
          onReviewed={async () => {
            await open(detail.block.id);
            await load();
          }}
        />
      ) : null}
    </section>
  );
}
