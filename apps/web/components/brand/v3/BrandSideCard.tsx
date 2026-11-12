import { Globe } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { initialsOf } from "@/lib/brand-studio/overview-cards";

/**
 * The Brand page's left card (08 §4.6, d17): the logo tile, the website, the name, the description and
 * Brand completion with its bar. The tile shows the initials until a logo can be drawn here.
 */
export function BrandSideCard({
  name,
  about,
  website,
  percent,
}: Readonly<{ name: string; about: string; website: string | null; percent: number }>) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-bg p-5 xl:sticky xl:top-4" aria-label="Your brand">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="grid size-18 place-items-center rounded-lg bg-navy text-h2 font-extrabold text-gold">
          {initialsOf(name)}
        </span>
        {website ? (
          <a href={website} rel="noopener noreferrer" target="_blank" className="grid size-10 place-items-center rounded-md text-text-2 live:hover:bg-soft" aria-label={`Your website, ${website}`}>
            <Icon icon={Globe} />
          </a>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-title text-text">{name}</h2>
        <p className="text-body text-muted">{about.trim() === "" ? "Add a line about your brand under Details." : about}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex items-center justify-between text-small font-medium text-text">
          Brand completion <span data-testid="brand-completion">{percent}% complete</span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-label="Brand completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </aside>
  );
}
