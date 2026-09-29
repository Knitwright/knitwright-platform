import type ts from "typescript";
import { calls, localNamesOf } from "./source";
import type { Violation } from "./wrapper-check";

/**
 * Pages and layouts that show a user's data must check the session themselves. A
 * layout's check is not enough: the framework does not run a layout again when the
 * user moves between the pages inside it.
 */

const GUARDS = "@/lib/server/page-guards";
const REQUIRE_MEMBER = { module: GUARDS, name: "requireMember" } as const;
const REQUIRE_SESSION = { module: GUARDS, name: "requireSession" } as const;

const PAGE_OR_LAYOUT = /\/(page|layout)\.[jt]sx?$/;

/** Route groups whose pages need a check, and which checks are enough for each. */
const GROUPS = [
  { folder: "app/(app)/", needs: "requireMember", accepted: [REQUIRE_MEMBER] },
  {
    folder: "app/(onboarding)/",
    needs: "requireSession",
    accepted: [REQUIRE_SESSION, REQUIRE_MEMBER],
  },
] as const;

export const pageGuardViolations = (path: string, source: ts.SourceFile): Violation[] => {
  const group = GROUPS.find(({ folder }) => path.startsWith(folder));
  if (!group || !PAGE_OR_LAYOUT.test(path)) return [];

  const guarded = group.accepted.some((guard) => calls(source, localNamesOf(source, guard)));
  return guarded
    ? []
    : [
        {
          file: path,
          rule: "page-not-guarded",
          detail: `This page must call ${group.needs}() from ${GUARDS} itself.`,
        },
      ];
};
