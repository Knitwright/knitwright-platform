import type { LoadedIllustrations } from "@/lib/images/illustrations";
import { ILLUSTRATION_LABEL, versionNote } from "@/lib/images/panel-state";

type FiguresProps = Readonly<{ loaded: LoadedIllustrations; currentVersion: number }>;

/** The pictures, each captioned as an illustration. Plan step 14, task 5. */
export function IllustrationFigures({ loaded, currentVersion }: FiguresProps) {
  const note = versionNote(loaded.version, currentVersion);
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold text-warn">{ILLUSTRATION_LABEL}</p>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {loaded.illustrations.map((item) => (
          <figure key={item.view} className="grid gap-2">
            {/* A data address made on the server: next/image cannot optimise it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={item.alt} className="w-full rounded-lg border border-hairline bg-white" />
            <figcaption className="text-sm text-muted">{item.label}. Illustration, not a specification.</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

type SectionProps = FiguresProps;

/** The tech pack's section of illustrations. Shown only when some were made. */
export function IllustrationsSection({ loaded, currentVersion }: SectionProps) {
  return (
    <section aria-labelledby="illustrations-heading" className="grid gap-4">
      <h2 id="illustrations-heading" className="text-lg font-semibold text-ink">
        Illustrations
      </h2>
      <IllustrationFigures loaded={loaded} currentVersion={currentVersion} />
    </section>
  );
}
