"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { OrganisationDetails } from "@/lib/leads/organisation";
import { OrganisationForm } from "./OrganisationForm";

/**
 * A small form beside a saved design, shown while the brand's organisation details are missing
 * (Platform and Store Guide, page 9: asked for when a design is saved). It never blocks the
 * design: "Not now" hides it until the page is opened again.
 */
export function OrganisationPrompt({ details }: Readonly<{ details: OrganisationDetails }>) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section aria-labelledby="organisation-prompt" className="rounded-2xl border border-hairline bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="organisation-prompt" className="text-base font-semibold text-ink">
            Your design is saved. Who is it for?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Tell us your type of organisation and where you are, so we can help with making it. You can skip this.
          </p>
        </div>
        <Button type="button" variant="quiet" onClick={() => setHidden(true)}>
          Not now
        </Button>
      </div>
      <div className="mt-4">
        <OrganisationForm details={details} submitLabel="Save organisation details" doneMessage="Thank you. The details are saved." />
      </div>
    </section>
  );
}
