import { Clapperboard, FileText, Layers, LayoutTemplate, Shirt } from "lucide-react";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { StartLaunch } from "@/components/launch-start/StartLaunch";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { PremiumMark } from "@/components/ui/Marks";
import type { FeedItem, FeedKind } from "@/lib/templates/feed/items";
import { UseDesignTemplate } from "./UseDesignTemplate";

/**
 * One template card (09 screen 7): a square picture, the "Use template" pill under it, then the
 * author line. ♛ sits top right of a template that spends credits. Long titles truncate and keep
 * the full title as a tooltip (10 §11).
 */

const KIND_ICONS: Readonly<Record<FeedKind, LucideIcon>> = {
  design: Shirt,
  pack: Layers,
  social: LayoutTemplate,
  video: Clapperboard,
  techpack: FileText,
};

function Picture({ item }: Readonly<{ item: FeedItem }>) {
  if (item.picture.type === "drawing") {
    // A data address of a drawing made here: nothing in it can run, and there is nothing to optimise.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.picture.src} alt={item.picture.alt} className="size-full object-contain p-4" />;
  }
  return (
    <span className="flex flex-col items-center gap-2 text-muted">
      <Icon icon={KIND_ICONS[item.kind]} size={22} />
      <span className="text-caption">{item.picture.label}</span>
    </span>
  );
}

function UseButton({ item }: Readonly<{ item: FeedItem }>) {
  const use = item.use;
  const named = `Use template: ${item.title}`;
  switch (use.type) {
    case "design":
      return <UseDesignTemplate templateId={use.templateId} title={item.title} />;
    case "launch":
      return (
        <StartLaunch source={use.source} slug={use.slug} label={named} pill>
          Use template
        </StartLaunch>
      );
    case "link":
      return (
        <LinkButton href={use.href as Route} variant="secondary" size="sm" className="w-full rounded-full">
          Use template<span className="sr-only">: {item.title}</span>
        </LinkButton>
      );
    default:
      return (
        <Button variant="secondary" size="sm" disabledReason={use.reason} className="w-full rounded-full" aria-label={named}>
          Use template
        </Button>
      );
  }
}

export function FeedCard({ item }: Readonly<{ item: FeedItem }>) {
  return (
    <article className="flex min-w-0 flex-col gap-2" aria-label={item.title}>
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-soft">
        <Picture item={item} />
        {item.premium ? <PremiumMark label="Uses credits" className="absolute top-2.5 right-2.5 grid size-6 rounded-full bg-bg shadow-e1" /> : null}
      </div>
      <UseButton item={item} />
      <p className="flex min-w-0 items-center gap-1.5 text-caption">
        <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full bg-navy" />
        <span className="shrink-0 text-muted">{item.author}</span>
        <span className="truncate font-semibold text-text" title={item.title}>
          {item.title}
        </span>
      </p>
      {item.reviewed ? <StatusPill tone="ok" className="w-fit">{item.reviewed}</StatusPill> : null}
    </article>
  );
}
