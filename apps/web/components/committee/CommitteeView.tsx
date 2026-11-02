import Link from "next/link";
import { PAGE_WIDTH } from "@/components/shell/page-width";
import { Notice } from "@/components/ui/Notice";
import { PAGE_LEAD, PRIVACY_NOTE } from "@/lib/share/committee/fields";
import type { CommitteeOption, CommitteePageData } from "@/lib/share/committee/public-view";
import { ApproveForm } from "./ApproveForm";
import { Committee3D } from "./Committee3D";
import { PinForm } from "./PinForm";
import { VoteForm } from "./VoteForm";

type CommitteeViewProps = Readonly<{ page: CommitteePageData; token: string; siteKey: string }>;

/** One option: its drawings, its read-only 3D view and the form that pins a comment to it. */
function Option({ option, token, siteKey }: Readonly<{ option: CommitteeOption; token: string; siteKey: string }>) {
  return (
    <section
      aria-labelledby={`option-${option.slot}`}
      className="flex flex-col gap-3 rounded-2xl border border-hairline p-4"
      data-testid={`committee-option-${option.slot}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`option-${option.slot}`} className="text-lg font-semibold text-ink">
          {option.label}
        </h3>
        <p className="text-sm text-muted">
          Version {option.version}, saved on {option.savedOn}
          {option.locked ? " · locked by the club" : ""}
        </p>
      </header>

      {option.preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {option.preview.views.map((view) => (
              <figure key={view.view} className="m-0 rounded-xl border border-hairline bg-white p-2">
                {/* A data address cannot go through next/image, and this is a drawing, not a photo. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={view.src}
                  alt={view.alt}
                  data-testid={`committee-flat-${option.slot}-${view.view}`}
                  className="mx-auto h-auto max-h-[22rem] w-full object-contain"
                />
                <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">{view.label}</figcaption>
              </figure>
            ))}
          </div>
          {option.preview.notice ? <p className="text-sm text-muted">{option.preview.notice}</p> : null}
          {option.preview.picturesNote ? <p className="text-sm text-muted">{option.preview.picturesNote}</p> : null}
          <Committee3D preview={option.preview} label={option.label} />
        </>
      ) : (
        <p className="text-sm text-muted">There is no drawing for this kind of garment yet.</p>
      )}

      {option.locked ? null : (
        <details className="rounded-xl border border-hairline">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-[15px] text-ink">
            Pin a comment on {option.label}
          </summary>
          <div className="border-t border-hairline p-3">
            <PinForm token={token} option={option} siteKey={siteKey} />
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * The whole committee page (spec F-T3, plan v5 Z7, decision 0086). Read only: there is no control
 * here that changes the design, and the only three things a visitor can leave are a pinned comment,
 * a vote and an approval given under their name.
 */
export function CommitteeView({ page, token, siteKey }: CommitteeViewProps) {
  const open = page.options.filter((option) => !option.locked);
  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">{page.brandName} asked your committee to look at this</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink" data-testid="committee-design-name">
          {page.designName}
        </h1>
        <p className="text-sm text-muted">This link works until {page.expiresOn}. You cannot change the design here.</p>
        <p className="text-[15px] leading-relaxed text-ink-2">{PAGE_LEAD}</p>
      </header>

      {page.lockedNote ? (
        <Notice tone="info">
          <span data-testid="committee-locked-note">{page.lockedNote}</span>
        </Notice>
      ) : null}
      {page.oneOptionNote ? <p className="text-sm text-muted">{page.oneOptionNote}</p> : null}

      <div className="flex flex-col gap-6">
        {page.options.map((option) => (
          <Option key={option.slot} option={option} token={token} siteKey={siteKey} />
        ))}
      </div>

      {page.options.length > 1 && open.length > 1 ? (
        <section aria-labelledby="committee-vote" className={`flex ${PAGE_WIDTH.form} flex-col gap-4`}>
          <h2 id="committee-vote" className="text-lg font-semibold text-ink">
            Your vote
          </h2>
          <VoteForm token={token} options={open} siteKey={siteKey} />
        </section>
      ) : null}

      {open.length > 0 ? (
        <section aria-labelledby="committee-approve" className={`flex ${PAGE_WIDTH.form} flex-col gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 id="committee-approve" className="text-lg font-semibold text-ink">
              Your approval
            </h2>
            <p className="text-sm text-muted">
              {PRIVACY_NOTE}{" "}
              <Link href="/legal/privacy" className="text-cobalt-soft underline-offset-4 hover:underline">
                Privacy notice
              </Link>
              .
            </p>
          </div>
          <ApproveForm token={token} options={open} siteKey={siteKey} />
        </section>
      ) : null}
    </>
  );
}
