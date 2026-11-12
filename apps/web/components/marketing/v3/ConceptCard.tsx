import { Play } from "lucide-react";
import type { Route } from "next";
import { StartLaunch } from "@/components/launch-start/StartLaunch";
import { Unavailable } from "@/components/launch-start/Unavailable";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { PremiumMark } from "@/components/ui/Marks";
import { cx } from "@/components/ui/cx";
import type { Concept, ConceptShape } from "@/lib/marketing/gallery/concepts";
import type { MarketingGroup } from "@/lib/marketing/templates/types";
import type { TemplatePreview } from "@/lib/templates/preview";

/**
 * One ad concept (09 screen 9): the garment on a backdrop in the concept's own shape, "Video" on a
 * video, ♛ on one that spends credits, and **Use this concept** on hover or focus. The backdrops are
 * the brand tokens, one per concept group, so nothing here is a colour of its own.
 */

const SHAPES: Readonly<Record<ConceptShape, string>> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  story: "aspect-[9/16]",
  wide: "aspect-video",
  a4: "aspect-[210/297]",
};

const BACKDROPS: Readonly<Record<MarketingGroup | "video", string>> = {
  "kit-launch": "from-navy to-electric",
  "club-life": "from-ok to-navy-3",
  "team-store": "from-gold to-warn",
  "brand-drop": "from-text to-text-2",
  "e-commerce": "from-electric to-electric-soft",
  print: "from-soft-2 to-border-strong",
  video: "from-navy-2 to-navy-3",
};

export function ConceptUse({ concept }: Readonly<{ concept: Concept }>) {
  const named = `Use this concept: ${concept.title}`;
  const use = concept.use;
  if (use.type === "launch") {
    return (
      <StartLaunch source="marketing" slug={use.slug} label={named} variant="primary">
        Use this concept
      </StartLaunch>
    );
  }
  if (use.type === "link") {
    return (
      <LinkButton href={use.href as Route} size="sm" className="w-full">
        Use this concept<span className="sr-only">: {concept.title}</span>
      </LinkButton>
    );
  }
  return (
    <Unavailable variant="primary" reason={use.reason} label={named} className="w-full">
      Use this concept
    </Unavailable>
  );
}

type CardProps = Readonly<{ concept: Concept; garment: TemplatePreview | null; shape?: ConceptShape; caption?: boolean }>;

export function ConceptCard({ concept, garment, shape, caption = false }: CardProps) {
  return (
    <figure className="group m-0 flex flex-col gap-2" aria-label={concept.title}>
      <div className={cx("relative grid place-items-center overflow-hidden rounded-lg bg-linear-to-b", SHAPES[shape ?? concept.shape], BACKDROPS[concept.group ?? "video"])}>
        {/* A data address of a drawing made here: nothing in it can run, and there is nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {garment ? <img src={garment.src} alt={garment.alt} className="max-h-40 w-2/5 object-contain" /> : null}
        {concept.kind === "video" ? (
          <span className="absolute top-3 left-3 inline-flex h-6 items-center gap-1 rounded-full bg-bg px-2 text-caption font-semibold text-text">
            <Icon icon={Play} size={14} />
            Video
          </span>
        ) : null}
        {concept.premium ? <PremiumMark label="Uses credits" className="absolute top-3 right-3 grid size-6 rounded-full bg-bg shadow-e1" /> : null}
        <div className="absolute inset-x-3 bottom-3 opacity-0 max-md:opacity-100 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
          <ConceptUse concept={concept} />
        </div>
      </div>
      <figcaption className={cx("truncate text-small", caption ? "text-center text-muted" : "text-text-2")} title={concept.title}>
        {concept.title}
      </figcaption>
    </figure>
  );
}
