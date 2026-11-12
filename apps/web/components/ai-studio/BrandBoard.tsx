"use client";

import { Upload } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextInput } from "@/components/ui/Inputs";
import { useToast } from "@/components/ui/Toast";
import { saveBrandPaletteAction } from "@/lib/brand-studio/actions";
import { askForKits } from "@/lib/crest-to-kit/client";
import { CREST_ACCEPT, CREST_FORMATS_HINT } from "@/lib/crest-to-kit/crest";
import type { SwatchView } from "@/lib/crest-to-kit/view";
import { FAILED_TOAST, type FramedWorkflow } from "./CanvasWorkflow";
import { GenerateFooter, Step, WorkflowFrame } from "./WorkflowFrame";

/**
 * Club brand board (decision 0141): the crest is read by crest to kit's own engine (`/api/crest-to-kit`,
 * which keeps nothing), its colours are drawn as a board with their names and print-safe estimates,
 * and "Save to my brand" writes them as a palette through Brand Studio's own action. Free: no model
 * draws anything, and the crest itself is never stored here.
 */

type Props = Readonly<{ workflow: FramedWorkflow; sportId: string }>;

const post = (input: string, init?: RequestInit) => fetch(input, init);

function Board({ name, palette }: Readonly<{ name: string; palette: readonly SwatchView[] }>) {
  return (
    <section aria-labelledby="board-heading" className="flex flex-col gap-4 rounded-3xl border border-border bg-bg p-6" data-testid="ai-studio-brand-board">
      <h2 id="board-heading" className="text-h2 text-text">
        {name === "" ? "Your brand board" : `${name} brand board`}
      </h2>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {palette.map((swatch) => (
          <li key={swatch.hex} className="flex flex-col gap-2">
            <span className="aspect-4/3 rounded-xl border border-border" style={{ backgroundColor: swatch.hex }} />
            <span className="text-title text-text">{swatch.name ?? "Unnamed colour"}</span>
            <span className="font-mono text-small text-muted">
              {swatch.hex} · {swatch.share} of the crest
            </span>
            {swatch.warning ? <span className="text-caption text-warn">{swatch.warning}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BrandBoard({ workflow, sportId }: Props) {
  const toast = useToast();
  const ids = { file: useId(), name: useId() };
  const [crest, setCrest] = useState<File | null>(null);
  const [club, setClub] = useState("");
  const [palette, setPalette] = useState<readonly SwatchView[] | null>(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);

  const read = async (): Promise<void> => {
    setPending(true);
    const outcome = await askForKits(post, { crest, sportId, roles: "all", feel: "classic", clubName: club, colours: [] });
    setPending(false);
    if (outcome.ok) return setPalette(outcome.data.palette);
    toast.show({ ...FAILED_TOAST, body: outcome.reason });
  };

  const save = async (): Promise<void> => {
    if (!palette) return;
    setSaving(true);
    const colours = palette.map((swatch, at) => ({ name: swatch.name ?? (at === 0 ? "Main colour" : `Colour ${at + 1}`), hex: swatch.hex, pantoneTcx: "" }));
    const reply = await saveBrandPaletteAction({ paletteId: null, name: club === "" ? "Crest colours" : `${club} colours`, colours });
    setSaving(false);
    toast.show(reply.success ? { tone: "success", title: "Saved to your brand", body: "The colours are a palette in your brand now." } : { tone: "error", title: "Not saved", body: reply.error.message });
  };

  const footer = <GenerateFooter label="Build my brand board" cost="Free" blocked={crest === null ? "Upload your crest first." : null} pending={pending} onGenerate={() => void read()} />;
  const after = palette ? (
    <div className="flex flex-col gap-4">
      <Board name={club} palette={palette} />
      <div>
        <Button variant="primary" pending={saving} onClick={() => void save()}>
          Save to my brand
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <WorkflowFrame title={workflow.title} lead={workflow.lead} tone={workflow.tone} poweredBy={workflow.poweredBy} footer={footer} after={after} example={3}>
      <div className="flex flex-col gap-8">
        <Step number={1} label="Upload your crest or logo" htmlFor={ids.file}>
          <label htmlFor={ids.file} className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-8 text-center live:hover:bg-soft">
            <span className="grid size-16 place-items-center rounded-full bg-soft text-muted">
              <Icon icon={Upload} size={22} />
            </span>
            <span className="text-body-lg text-text-2">{crest ? crest.name : "Drop an image or choose a file"}</span>
            <span className="text-small text-muted">{CREST_FORMATS_HINT} Nothing is kept.</span>
          </label>
          <input id={ids.file} type="file" accept={CREST_ACCEPT} className="sr-only" onChange={(event) => setCrest(event.target.files?.[0] ?? null)} />
        </Step>
        <Step number={2} label="Club name (optional)" htmlFor={ids.name}>
          <TextInput id={ids.name} maxLength={60} value={club} placeholder="Northfield FC" onChange={(event) => setClub(event.target.value)} />
        </Step>
      </div>
    </WorkflowFrame>
  );
}
