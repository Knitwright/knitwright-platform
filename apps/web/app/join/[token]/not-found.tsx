import { pageFrame } from "@/components/shell/page-width";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { LINK_CLOSED_BODY, LINK_CLOSED_TITLE } from "@/lib/clubs/signup/fields";

/**
 * What a sign-up link that no longer works says (plan v5 Z7, decision 0087). The answer is still
 * 404, and deliberately so: a link that ran out, a link that was withdrawn and an address that was
 * never a link all take one path and give one answer, because telling them apart would say whether
 * a link exists (decision 0026). What changes here is only the words: a player is told what
 * probably happened and who to ask.
 */
export default function SignupLinkClosedPage() {
  return (
    <>
      <PublicHeader linkHome={false} width="form" />
      <main id="main" className={`rise ${pageFrame("form")} flex flex-1 flex-col py-16`}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{LINK_CLOSED_TITLE}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2" data-testid="signup-link-closed">
          {LINK_CLOSED_BODY}
        </p>
      </main>
    </>
  );
}
