import { Plus, Shield, Wand2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";

/**
 * The Brand page before anything is saved (09 screen 18 empty, 08 §4.6 "Import your brand", d16):
 * the heading, a URL field with Import, OR, + Create new and Start from my crest, and the video slot
 * on the right. Import is a plain form that opens the import screen with the address filled in, so it
 * works without scripts; the import itself is L7's engine (decision 0102).
 */
export function BrandEmpty({ canEdit }: Readonly<{ canEdit: boolean }>) {
  return (
    <div className="grid items-start gap-10 pt-12 lg:grid-cols-2 xl:pl-40">
      <section aria-labelledby="brand-empty" className="flex max-w-135 flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h1 id="brand-empty" className="text-display text-text">
            Your club or brand, applied everywhere
          </h1>
          <p className="text-body-lg text-text-2">
            Your crest, logos, colours, fonts, kit colours and style in one place, so every kit, post and video starts on-brand.
          </p>
        </div>
        {canEdit ? (
          <>
            <form action="/brand/import" method="get" className="flex flex-col gap-5">
              <label htmlFor="brand-url" className="sr-only">
                Your website or Instagram link
              </label>
              <input
                id="brand-url"
                name="url"
                type="url"
                inputMode="url"
                required
                placeholder="www.yourclub.com or Instagram link"
                className="h-12 rounded-md border border-border bg-bg px-4 text-body-lg text-text placeholder:text-muted"
              />
              <button type="submit" className={buttonClasses("secondary", false, "h-14 w-full bg-soft text-body-lg", "lg")}>
                <Icon icon={Wand2} />
                Import
              </button>
            </form>
            <p className="flex items-center gap-4 text-small font-semibold text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              OR
              <span className="h-px flex-1 bg-border" />
            </p>
            <div className="flex flex-col gap-3">
              <LinkButton href="/brand?tab=overview" variant="secondary" size="lg" icon={<Icon icon={Plus} />} className="h-14 w-full">
                Create new
              </LinkButton>
              <LinkButton href="/crest-to-kit" variant="secondary" size="lg" icon={<Icon icon={Shield} />} className="h-14 w-full">
                Start from my crest
              </LinkButton>
            </div>
          </>
        ) : (
          <p className="text-body text-muted">Your role can look at the brand but not change it. Ask an owner, an admin or a kit manager to set it up.</p>
        )}
      </section>
      <VideoSlot />
    </div>
  );
}

/** Where the brand video goes. No video ships yet, so it is our own navy and gold tile, not a player. */
function VideoSlot() {
  return (
    <figure aria-label="Brand video, coming soon" className="relative m-0 grid aspect-[16/9] place-items-center overflow-hidden rounded-2xl bg-navy">
      <span aria-hidden="true" className="absolute -top-16 -right-10 size-56 rounded-full bg-gold opacity-60 blur-3xl" />
      <span aria-hidden="true" className="absolute -bottom-20 -left-12 size-56 rounded-full bg-gold opacity-50 blur-3xl" />
      <span aria-hidden="true" className="relative text-display font-extrabold tracking-tight text-on-dark">
        BRAND ▶
      </span>
      <figcaption className="sr-only">A short video about the Brand page will play here.</figcaption>
    </figure>
  );
}
