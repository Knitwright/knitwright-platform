import Link from "next/link";
import { KitPanel } from "@/components/club/KitPanel";
import { UseKitButton } from "@/components/club/UseKitButton";
import { PageSection } from "@/components/shell/PageSection";
import { listArtworks } from "@/lib/artwork-intake/service";
import { can } from "@/lib/clubs/roles";
import { getKit } from "@/lib/clubs/service";
import { listProjects } from "@/lib/projects/service";
import type { Brand } from "@/lib/server/core/guard";
import { sessionClient } from "@/lib/server/deps";

/**
 * The club kit on Brand › Sportswear (08 §4.6 "kit colours mapped to palette swatches"), moved from the
 * club page with its "Use kit" on each design (decision 0144). `club_kits` stays the one place the kit
 * is written (decisions 0042, 0079); the Colours tab still reads it through.
 */

const DESIGNS_SHOWN = 12;

export async function KitSection({ brand }: Readonly<{ brand: Brand }>) {
  const client = await sessionClient();
  const [kit, artworks, designs] = await Promise.all([getKit(client, brand.id), listArtworks(client, brand.id), listProjects(client, brand.id, DESIGNS_SHOWN)]);
  const pictures = artworks.map((artwork) => ({ fileId: artwork.screenFileId, label: artwork.label }));
  const canEdit = can(brand.role, "manageKit");

  return (
    <>
      <PageSection id="kit" title="Club kit" description="Colours, crest and sponsors. Use them on any design with one press; each design keeps its own copy.">
        <KitPanel kit={kit} pictures={pictures} canEdit={canEdit} />
      </PageSection>
      <PageSection
        id="kit-designs"
        title="Use the kit on a design"
        description={designs.total > DESIGNS_SHOWN ? `Your newest ${DESIGNS_SHOWN} of ${designs.total}.` : "Puts the kit's colours, crest and sponsors on the design as a new version."}
      >
        {designs.projects.length === 0 ? (
          <p className="text-body text-muted">
            No designs yet. <Link href="/studio/new" className="text-link">Start one</Link>.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {designs.projects.map((design) => (
              <li key={design.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/studio/${design.id}`} className="block min-w-0 truncate py-2 text-body text-text no-underline live:hover:underline">
                  {design.name} <span className="text-muted">· {design.garmentLabel} · version {design.currentVersion}</span>
                </Link>
                {canEdit ? <UseKitButton projectId={design.id} version={design.currentVersion} /> : null}
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </>
  );
}
