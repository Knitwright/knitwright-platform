import { sessionClient } from "@/lib/server/deps";
import { buildShareLinkViews } from "@/lib/share/responses";
import { listShareLinks } from "@/lib/share/service";
import { SharePanel } from "./SharePanel";

type ShareSectionProps = Readonly<{ brandId: string; projectId: string; currentVersion: number }>;

/**
 * The design page's share panel, with the links and answers read as the member, so the database
 * decides what they see. The page has already checked the member and the design.
 */
export async function ShareSection({ brandId, projectId, currentVersion }: ShareSectionProps) {
  const { links, answers } = await listShareLinks(await sessionClient(), brandId, projectId);
  return <SharePanel projectId={projectId} links={buildShareLinkViews(links, answers, currentVersion, new Date())} />;
}
