"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { ARTBOARD_UNITS, launchProjectPath, UNIT_LABELS, type ArtboardUnit } from "@/lib/launch";
import { createLaunchProjectAction, saveBoardAction } from "@/lib/launch/actions";

export type DesignChoice = Readonly<{ id: string; name: string; version: number }>;

type Props = Readonly<{ designs: readonly DesignChoice[]; canEdit: boolean }>;

/**
 * Starts a launch project. A project begins on one of the brand's designs, and the Design board
 * for it is put on the canvas straight away: every mockup, picture, clip and post comes from that
 * board, so the garment is always the one the platform drew (spec decision 13).
 *
 * A project may be started with no design yet -- a person may be laying out an artboard first --
 * and the canvas then says so and offers the one action that fixes it.
 */
export function NewLaunchProject({ designs, canEdit }: Props) {
  const router = useRouter();
  const ids = { name: useId(), design: useId(), unit: useId() };
  const [name, setName] = useState("");
  const [designId, setDesignId] = useState(designs[0]?.id ?? "");
  const [unit, setUnit] = useState<ArtboardUnit>("px");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const design = designs.find((one) => one.id === designId) ?? null;
    start(async () => {
      const made = await createLaunchProjectAction({ name: name.trim(), units: unit, designProjectId: design?.id ?? null }).catch(() => null);
      if (!made) return setProblem("The launch project could not be started. Check your connection and try again.");
      if (!made.success) return setProblem(made.error.message);
      if (design) {
        await saveBoardAction({
          launchProjectId: made.data.id,
          boardId: null,
          kind: "design",
          name: design.name,
          x: 0,
          y: 0,
          settings: { designProjectId: design.id },
          inputVersion: design.version,
        }).catch(() => null);
      }
      router.push(launchProjectPath(made.data.id) as Route);
    });
  };

  if (!canEdit) return <p className="text-sm text-muted">Only owners, admins and kit managers can start a launch project.</p>;

  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-medium text-ink">
          Name this launch
        </label>
        <input id={ids.name} required maxLength={80} className={FIELD_CONTROL} value={name} onChange={(event) => setName(event.target.value)} placeholder="Home kit launch" />
      </div>

      <div className="flex min-w-48 flex-col gap-1.5">
        <label htmlFor={ids.design} className="text-sm font-medium text-ink">
          Design to launch
        </label>
        <select id={ids.design} className={FIELD_CONTROL} value={designId} onChange={(event) => setDesignId(event.target.value)}>
          <option value="">Choose one later</option>
          {designs.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name} (version {one.version})
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-40 flex-col gap-1.5">
        <label htmlFor={ids.unit} className="text-sm font-medium text-ink">
          Units
        </label>
        <select id={ids.unit} className={FIELD_CONTROL} value={unit} onChange={(event) => setUnit(event.target.value as ArtboardUnit)}>
          {ARTBOARD_UNITS.map((one) => (
            <option key={one} value={one}>
              {UNIT_LABELS[one]}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" pending={pending} disabled={name.trim() === ""}>
        Start the launch
      </Button>

      {problem ? (
        <div className="w-full">
          <Notice tone="warn" role="alert">
            {problem}
          </Notice>
        </div>
      ) : null}
    </form>
  );
}
