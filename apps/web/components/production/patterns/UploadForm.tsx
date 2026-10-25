"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { uploadSet } from "@/lib/pattern-library/client";
import type { SlotState } from "@/lib/pattern-library/slots";

const OUTLINES = [
  { id: "", label: "I am not sure. Ask me." },
  { id: "net", label: "No: the outline is the sewn size (add seam allowance)" },
  { id: "gross", label: "Yes: the outline is the cut size, seam allowance included" },
] as const;

const CUTS = [
  { id: "mens", label: "Men's cut" },
  { id: "womens", label: "Women's cut" },
  { id: "junior", label: "Junior cut" },
  { id: "unisex", label: "Unisex cut" },
] as const;

const WEARERS = [
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "youth", label: "Youth" },
] as const;

/** Uploads the DXF files of a size set: one file per size, or one file holding every size. */
export function UploadForm({ slots, onStored }: Readonly<{ slots: readonly SlotState[]; onStored: () => void }>) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);
  const products = slots.filter((s) => s.slot.kind === "pieces").map((s) => ({ id: s.slot.productKey, label: s.slot.label }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("outline") === "") form.delete("outline");
    form.set("source", "technician-upload");
    setBusy(true);
    setProblem(null);
    setDone(null);
    const result = await uploadSet(form);
    setBusy(false);
    if (result.ok) {
      setDone([`Stored as version ${result.data.version}: ${result.data.sizes.join(", ")}.`, ...result.data.questions]);
      onStored();
    } else setProblem(result.reason);
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-xl border border-hairline p-4" aria-labelledby="upload-pattern-heading">
      <h4 id="upload-pattern-heading" className="text-sm font-medium text-ink">
        Add a pattern from DXF files
      </h4>
      <SelectField name="productKey" label="Product" options={products} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField name="wearer" label="Who it is for" options={WEARERS} />
        <SelectField name="cut" label="Cut" options={CUTS} />
      </div>
      <SelectField name="outline" label="Does the outline already include seam allowance?" options={OUTLINES} hint="A file that does not say is never guessed." />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pattern-files" className="text-sm font-medium text-ink">
          DXF files
        </label>
        <input id="pattern-files" name="files" type="file" accept=".dxf" multiple required className="min-h-10 text-sm text-ink-2" />
        <p className="text-sm text-muted">One file for each size, or one file with every size in it.</p>
      </div>
      <div>
        <Button type="submit" pending={busy}>
          Add the pattern
        </Button>
      </div>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
      {done ? (
        <Notice tone="ok">
          {done.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Notice>
      ) : null}
    </form>
  );
}
