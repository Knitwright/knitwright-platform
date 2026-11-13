"use client";

import { ChevronRight, Globe, Lock, Monitor, UserCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AccessList } from "@/components/share/AccessList";
import { InviteForm } from "@/components/share/InviteForm";
import { CreateLink } from "@/components/share/SharePanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Segmented } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { loadShareAction } from "@/lib/order-boards/actions";
import { FACTORY_DESK, PUBLISH_LATER, PRESENTATION_LATER } from "@/lib/order-boards/share";
import type { OrderableDesign } from "@/lib/order-boards/types";
import { useOrderBoards } from "./OrderBoardsContext";
import { PanelFrame } from "./PanelFrame";
import { useLoaded } from "./useLoaded";

/**
 * THE SHARE POPOVER (plan v6 E4, decision 0148; `08` v3.6 and §5.7, e28, e29): "Share project" with
 * Link | Invite, then View presentation, Publish project › and Request approval.
 *
 * Link and Invite are the design's existing share code (decisions 0049 and 0117): a link to one
 * version that the member sends themselves, shown once; an invite per email address with Can view /
 * Can comment / Can edit. The member rows add the Knitwright factory desk, which sees the tech pack
 * and nothing else, and only once an order reaches it. Presentation mode and publishing to the
 * community are not built yet; both say so instead of opening nothing.
 */

type View = "link" | "invite" | "publish";

export function SharePopover({ design, onClose }: Readonly<{ design: OrderableDesign | null; onClose: () => void }>) {
  const [view, setView] = useState<View>("link");
  if (view === "publish") {
    return (
      <PanelFrame title="Publish project" onClose={onClose} onBack={() => setView("link")} testId="share-popover">
        <p className="text-body text-text-2">{PUBLISH_LATER}</p>
        <Button variant="primary" className="w-full" disabledReason="Publishing to the community is not built yet.">
          Publish
        </Button>
      </PanelFrame>
    );
  }
  return (
    <PanelFrame title="Share project" onClose={onClose} testId="share-popover">
      <Segmented
        label="Share by"
        value={view}
        onChange={(id) => setView(id === "invite" ? "invite" : "link")}
        options={[
          { id: "link", label: "Link" },
          { id: "invite", label: "Invite" },
        ]}
        className="w-full [&>button]:flex-1"
      />
      {design === null ? (
        <p className="text-small text-muted">Add a garment board first: a share link and an invite are for a design.</p>
      ) : view === "link" ? (
        <LinkTab design={design} />
      ) : (
        <InviteTab design={design} />
      )}
      <ul className="flex flex-col border-t border-border pt-2">
        <Row icon={<Icon icon={Monitor} size={20} />} label="View presentation" later={PRESENTATION_LATER} />
        <li>
          <button
            type="button"
            onClick={() => setView("publish")}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-body text-text live:hover:bg-soft"
            data-testid="share-publish"
          >
            <Icon icon={Globe} size={20} />
            <span className="flex-1">Publish project</span>
            <Icon icon={ChevronRight} size={16} />
          </button>
        </li>
        <li>
          <Link
            href={"/team?tab=approvals" as Route}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-body text-text live:hover:bg-soft"
            data-testid="share-request-approval"
          >
            <Icon icon={UserCheck} size={20} />
            <span className="flex-1">Request approval</span>
            <span className="text-caption text-muted">committee · factory</span>
          </Link>
        </li>
      </ul>
    </PanelFrame>
  );
}

function Row({ icon, label, later }: Readonly<{ icon: ReactNode; label: string; later: string }>) {
  return (
    <li>
      <Tooltip content={later}>
        <button type="button" aria-disabled="true" className="flex min-h-11 w-full cursor-not-allowed items-center gap-3 rounded-md px-2 text-left text-body text-muted">
          {icon}
          <span className="flex-1">{label}</span>
          <span className="text-caption">Coming</span>
        </button>
      </Tooltip>
    </li>
  );
}

function LinkTab({ design }: Readonly<{ design: OrderableDesign }>) {
  return (
    <div className="flex flex-col gap-2" data-testid="share-link-tab">
      <p className="flex items-center gap-2 text-body text-text">
        <Icon icon={Lock} size={16} />
        Only invited people and links you make can open it
      </p>
      <p className="text-caption text-muted">
        A link shows version {design.version} of {design.name}: the drawings, colours and fabrics, with a vote and a comment. It never shows
        measurements, notes or files. Copy it when it is made; it is shown only once.
      </p>
      <CreateLink projectId={design.id} />
    </div>
  );
}

function InviteTab({ design }: Readonly<{ design: OrderableDesign }>) {
  const { brandName } = useOrderBoards();
  const { loaded, retry } = useLoaded(() => loadShareAction({ projectId: design.id, version: design.version }), `${design.id}:${design.version}`);
  return (
    <div className="flex flex-col gap-3" data-testid="share-invite-tab">
      <InviteForm projectId={design.id} />
      <Link href={"/settings" as Route} className="self-start text-small font-semibold text-link live:hover:underline" data-testid="share-members">
        Brand members in Settings
      </Link>
      <ul className="flex flex-col gap-1" aria-label="Members">
        <Member name={brandName === "" ? "Anyone in your brand" : `Anyone at ${brandName}`} access="Can access" />
        <Member name="You" access="Owner" />
        <Member name={FACTORY_DESK.name} access={FACTORY_DESK.access} note={FACTORY_DESK.note} testId="share-factory-desk" />
      </ul>
      {loaded.state === "loading" ? (
        <SkeletonText lines={2} />
      ) : loaded.state === "error" ? (
        <div className="flex flex-col gap-2">
          <Notice tone="warn" role="alert">
            {loaded.message}
          </Notice>
          <Button variant="secondary" size="sm" className="self-start" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        <AccessList projectId={design.id} rows={loaded.data.access} />
      )}
    </div>
  );
}

function Member({ name, access, note, testId }: Readonly<{ name: string; access: string; note?: string; testId?: string }>) {
  return (
    <li className="flex items-start justify-between gap-3 py-1" data-testid={testId}>
      <span className="min-w-0">
        <span className="block text-body text-text">{name}</span>
        {note ? <span className="block text-caption text-muted">{note}</span> : null}
      </span>
      <span className="shrink-0 text-small text-muted">{access}</span>
    </li>
  );
}
