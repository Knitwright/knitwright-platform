import { Lock } from "lucide-react";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";
import { GRID } from "./GridTiles";

/** The Projects page while it is read (10 §9): the sub-tabs, the controls and a grid of cards, as bars. */
export function ProjectsSkeleton({ label = "Loading your projects" }: Readonly<{ label?: string }>) {
  return (
    <SkeletonPage label={label} className="flex flex-col gap-8 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-13 w-96 max-w-full rounded-xl" />
        <Skeleton className="h-13 w-120 max-w-full rounded-lg" />
      </div>
      <div className={GRID}>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

/** An empty list (10 §9): a glyph in a `soft` circle, a title, one line and at most one action. */
export function EmptyList({ icon, title, children, action }: Readonly<{ icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }>) {
  return (
    <EmptyState icon={icon} title={title} action={action} className="pt-20">
      {children}
    </EmptyState>
  );
}

/**
 * No permission (10 §9) for a viewer, who may open the brand's projects but not file or trash
 * them. Roles are given on the club page, so the action goes there.
 */
export function ViewerOnly({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <EmptyState
      icon={<Icon icon={Lock} size={22} />}
      title="Ask the owner for access"
      className="pt-20"
      action={
        <LinkButton href={"/club" as Route} variant="secondary">
          See who can change roles
        </LinkButton>
      }
    >
      <p>
        You can open <span className="font-semibold text-text-2">{brandName}</span>&apos;s projects. Filing them in folders and the Trash needs an
        admin or a kit manager, and the owner can give you that role.
      </p>
    </EmptyState>
  );
}
