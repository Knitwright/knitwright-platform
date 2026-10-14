"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { readResolution, resolutionLines } from "@/lib/artwork-intake/client";

type Props = Readonly<{ artworkId: string; kind: "raster" | "vector" }>;

/** How sharp the artwork would print at a width the person chooses, with the plain warning when it is too soft. */
export function ResolutionReadout({ artworkId, kind }: Props) {
  const id = useId();
  const [width, setWidth] = useState("");
  const [lines, setLines] = useState<readonly string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const check = async () => {
    setProblem(null);
    const value = Number(width);
    if (!(value > 0)) return setProblem("Enter the printed width in millimetres, such as 90.");
    const result = await readResolution(artworkId, value);
    if (!result.ok || !result.data.resolution) return setProblem(result.ok ? "No answer came back. Try again." : result.message);
    setLines(resolutionLines(result.data.resolution));
  };

  if (kind === "vector") return <p className="text-sm text-ink-2">This is a drawing, so it prints sharply at any size.</p>;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Printed width in millimetres
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={1}
          value={width}
          onChange={(event) => setWidth(event.target.value)}
          className="h-11 w-32 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink"
        />
        <Button type="button" variant="secondary" onClick={() => void check()}>
          Check sharpness
        </Button>
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-ink-2">
        {problem ? <p>{problem}</p> : lines.map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}
