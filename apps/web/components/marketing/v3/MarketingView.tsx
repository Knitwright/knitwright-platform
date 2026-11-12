import { Megaphone, PencilLine, Workflow } from "lucide-react";
import type { Route } from "next";
import { StartLaunch } from "@/components/launch-start/StartLaunch";
import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { galleryHref, type Concept, type GalleryFilter } from "@/lib/marketing/gallery/concepts";
import type { TemplatePreview } from "@/lib/templates/preview";
import { ConceptCard } from "./ConceptCard";
import { GalleryChips } from "./GalleryChips";

/** The Marketing area's two tabs in the top bar (09 screen 9 and d15). */
export const MARKETING_TABS = [
  { href: "/marketing" as Route, label: "Ads" },
  { href: "/marketing/launch-packs" as Route, label: "Launch packs" },
];

/** The three networks a concept is sized for, as plain letter marks of our own: no network's logo. */
const NETWORKS = [
  { mark: "IG", name: "Instagram", tone: "bg-navy" },
  { mark: "f", name: "Facebook", tone: "bg-link" },
  { mark: "TT", name: "TikTok", tone: "bg-text" },
] as const;

function Hero() {
  return (
    <section className="flex flex-col items-center gap-5 pt-6 text-center">
      <ul aria-label="Sized for Instagram, Facebook and TikTok" className="flex gap-2.5">
        {NETWORKS.map((one) => (
          <li key={one.mark} className={`grid size-10 place-items-center rounded-md text-small font-extrabold text-on-dark ${one.tone}`}>
            <span aria-hidden="true">{one.mark}</span>
            <span className="sr-only">{one.name}</span>
          </li>
        ))}
      </ul>
      <h1 className="text-h1 text-text">Never run out of ideas for kit launches</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <StartLaunch source="ad" variant="secondary" size="lg" icon={<Icon icon={PencilLine} size={20} />}>
          Create an ad
        </StartLaunch>
        <LinkButton href="/marketing/launch-packs" variant="secondary" size="lg" icon={<Icon icon={Workflow} size={20} />}>
          Plan a launch pack
        </LinkButton>
      </div>
    </section>
  );
}

export type MarketingViewProps = Readonly<{
  featured: readonly Concept[];
  gallery: readonly Concept[];
  filter: GalleryFilter;
  sports: readonly Readonly<{ id: string; label: string }>[];
  garment: TemplatePreview | null;
}>;

/** The v3.9 Marketing page (09 screen 9, decision 0140), drawn from data the page has already read. */
export function MarketingView({ featured, gallery, filter, sports, garment }: MarketingViewProps) {
  return (
    <div className="flex flex-col gap-10">
      <TopBarTabs label="Marketing" tabs={MARKETING_TABS} />
      <Hero />
      {featured.length > 0 ? (
        <section aria-labelledby="featured-concepts" className="flex flex-col gap-3">
          <h2 id="featured-concepts" className="text-h3 text-text">Featured concepts</h2>
          <ul aria-label="Featured concepts" className="-mx-1 flex snap-x gap-3.5 overflow-x-auto px-1 pb-2">
            {featured.map((concept) => (
              <li key={concept.id} className="w-50 shrink-0 snap-start">
                <ConceptCard concept={concept} garment={garment} shape="portrait" caption />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="ad-gallery" className="flex flex-col gap-4">
        <h2 id="ad-gallery" className="text-h3 text-text">Ad gallery</h2>
        <GalleryChips filter={filter} sports={sports} />
        {gallery.length === 0 ? (
          <EmptyState icon={<Icon icon={Megaphone} size={22} />} title="No concept matches" action={<LinkButton href={galleryHref({ kind: "all", group: null, sport: filter.sport }) as Route}>Show every concept</LinkButton>}>
            Clear a filter to see more.
          </EmptyState>
        ) : (
          <ul aria-label="Ad gallery" className="columns-1 gap-4 sm:columns-2 lg:columns-4">
            {gallery.map((concept) => (
              <li key={concept.id} className="mb-4 break-inside-avoid">
                <ConceptCard concept={concept} garment={garment} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
