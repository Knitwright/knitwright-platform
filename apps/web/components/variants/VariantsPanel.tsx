"use client";

import { readJson } from "@/lib/http/read-json";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { appliedSentence, KIND_HEADINGS, parseApplied, parseList, UNREADABLE, type TileView } from "@/lib/variants/answers";

type Props = Readonly<{ projectId: string; version: number; busy: boolean }>;
type Tiles = readonly TileView[];

const KINDS = ["colourway", "kit-style", "placement"] as const;

/**
 * Alternatives for the design as it is now: colourways, kit styles and artwork placements, each drawn by the
 * same flat renderer as the editor. Pressing one saves it as a new version. The changes are worked out on the
 * server from the tile's id; the browser sends no changes. A mood-image section would sit apart from this one.
 */
export function VariantsPanel({ projectId, version, busy }: Props) {
  const router = useRouter();
  // What was read, with the version it was read for; a list for another version counts as not read yet.
  const [read, setRead] = useState<Readonly<{ version: number; tiles: Tiles | null; problem: string | null }> | null>(null);
  const [applyProblem, setApplyProblem] = useState<string | null>(null);
  const current = read?.version === version ? read : null;
  const tiles = current?.tiles ?? null;
  const problem = applyProblem ?? current?.problem ?? null;
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/variants`, { signal: controller.signal })
      .then((response) => readJson(response))
      .then((body) => {
        const answer = parseList(body);
        setRead(answer.ok ? { version, tiles: answer.tiles, problem: null } : { version, tiles: null, problem: answer.message });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRead({ version, tiles: null, problem: UNREADABLE });
      });
    return () => controller.abort();
  }, [projectId, version]);

  const apply = async (variantId: string) => {
    setPending(variantId);
    setNote(null);
    setApplyProblem(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/variants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, expectedVersion: version }),
      });
      const answer = parseApplied(await readJson(response));
      if (answer.ok) {
        setNote(appliedSentence(answer.created, answer.version));
        router.refresh();
      } else {
        setApplyProblem(answer.message);
      }
    } catch {
      setApplyProblem(UNREADABLE);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="variants-panel">
      <p className="text-[15px] leading-relaxed text-muted">
        Other ways this design could look. Each is a set of ordinary changes. Press one to save it as a new version; History can take it back.
      </p>
      <p role="status" aria-live="polite" data-testid="variants-note" className="text-sm text-ink">
        {note}
      </p>
      {problem ? (
        <p role="alert" className="text-sm text-red-700" data-testid="variants-problem">
          {problem}
        </p>
      ) : null}
      {tiles === null && !problem ? <p className="text-sm text-muted">Drawing the alternatives…</p> : null}
      {tiles && tiles.length === 0 ? <p className="text-sm text-muted">This garment has no alternatives yet.</p> : null}
      {tiles
        ? KINDS.map((kind) => {
            const group = tiles.filter((tile) => tile.kind === kind);
            if (group.length === 0) return null;
            return (
              <section key={kind} aria-label={KIND_HEADINGS[kind]} className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-ink">{KIND_HEADINGS[kind]}</h3>
                <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
                  {group.map((tile) => (
                    <li key={tile.id} data-testid="variant-tile" data-variant={tile.id} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-2">
                      {tile.src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a data address for a drawing; nothing in it can run
                        <img src={tile.src} alt={tile.alt} className="aspect-square w-full rounded-xl bg-canvas object-contain" />
                      ) : null}
                      <p className="text-[13px] font-medium text-ink">{tile.label}</p>
                      <p className="text-xs leading-snug text-muted">{tile.summary}</p>
                      {tile.warnings.length > 0 ? (
                        <ul className="text-xs leading-snug text-amber-800" aria-label="Warnings this alternative still carries">
                          {tile.warnings.map((warning) => (
                            <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                          ))}
                        </ul>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void apply(tile.id)}
                        disabled={busy || pending !== null}
                        aria-label={`Use ${tile.label}`}
                        className="mt-auto h-9 rounded-full border border-hairline px-3 text-sm font-medium text-ink hover:bg-cobalt-wash disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {pending === tile.id ? "Saving…" : "Use this"}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        : null}
    </div>
  );
}
