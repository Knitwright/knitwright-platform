"use client";

import { useTechPackEdit } from "@/components/techpack/TechPackEdit";
import { TechPackEditor, type TechPackEditorProps } from "./TechPackEditor";

/**
 * The tech pack editor on the `/studio/<id>/tech-pack` page: it reads the design as it will be once
 * the waiting changes land, and saves through the page's own queue (`TechPackEdit`), so a callout
 * added on the stage and an edit in the factory file below go through one queue, one at a time.
 */
export function TechPackEditorOnPage(props: Omit<TechPackEditorProps, "spec" | "onSave" | "busy">) {
  const edit = useTechPackEdit();
  return (
    <section aria-labelledby="techpack-editor-title" className="flex flex-col gap-2 lg:h-[min(56rem,88vh)]">
      <h2 id="techpack-editor-title" className="sr-only">
        Tech pack editor
      </h2>
      <TechPackEditor {...props} spec={edit.working} onSave={edit.save} busy={edit.busy} />
    </section>
  );
}
