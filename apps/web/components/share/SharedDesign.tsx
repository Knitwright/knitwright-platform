import type { SharePageData, SharePicture } from "@/lib/share/public-view";

type SharedDesignProps = Readonly<{ page: SharePageData; picturesNote: string | null }>;

/** One drawing. It is a data address in an image tag, so nothing in it can run. */
function Drawing({ picture, testId }: Readonly<{ picture: SharePicture; testId: string }>) {
  return (
    <figure className="m-0 rounded-xl border border-hairline bg-white p-2">
      {picture.src ? (
        // A data address cannot go through next/image, and this is a drawing, not a photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture.src}
          alt={picture.alt}
          data-testid={testId}
          className="mx-auto h-auto max-h-[28rem] w-full object-contain"
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted">{picture.notice}</p>
      )}
      <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">{picture.label}</figcaption>
    </figure>
  );
}

/** What a committee sees: the drawings, the colours and the fabrics. Nothing a factory reads. */
export function SharedDesign({ page, picturesNote }: SharedDesignProps) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">{page.brandName} shared this design with you</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink" data-testid="share-design-name">
          {page.designName}
        </h1>
        <p className="text-sm text-muted">
          Version {page.version}, saved on {page.savedOn}. This link works until {page.expiresOn}.
        </p>
      </header>

      <section aria-labelledby="share-drawings" className="flex flex-col gap-3">
        <h2 id="share-drawings" className="text-lg font-semibold text-ink">
          Front and back
        </h2>
        {picturesNote ? <p className="text-sm text-muted">{picturesNote}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {page.flats.map((picture) => (
            <Drawing key={picture.view} picture={picture} testId={`share-flat-${picture.view}`} />
          ))}
        </div>
      </section>

      <section aria-labelledby="share-colours" className="flex flex-col gap-4">
        <h2 id="share-colours" className="text-lg font-semibold text-ink">
          Colours
        </h2>
        {page.colourways.map((colourway) => (
          <div key={colourway.id} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Drawing picture={colourway.picture} testId={`share-colourway-${colourway.id}`} />
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-ink">{colourway.name}</h3>
              <ul className="flex flex-col gap-1.5">
                {colourway.colours.map((colour) => (
                  <li key={colour.panel} className="flex items-center gap-2 text-[15px] text-ink-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 shrink-0 rounded border border-hairline"
                      style={colour.swatch ? { backgroundColor: colour.swatch } : undefined}
                    />
                    <span>
                      {colour.panel}: {colour.colour ?? (colour.swatch ? "colour shown" : "not chosen yet")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="share-fabrics" className="flex flex-col gap-2">
        <h2 id="share-fabrics" className="text-lg font-semibold text-ink">
          Fabrics
        </h2>
        <ul className="flex flex-col gap-1.5">
          {page.fabrics.map((fabric) => (
            <li key={`${fabric.name}-${fabric.panels.join(",")}`} className="text-[15px] text-ink-2">
              <span className="font-medium text-ink">{fabric.name}</span>
              {fabric.composition ? `, ${fabric.composition}` : ""}. Used for: {fabric.panels.join(", ")}.
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
