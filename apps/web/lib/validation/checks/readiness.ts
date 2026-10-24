import type { Finding } from "@/lib/production/contract";
import { finding } from "../finding";
import type { DesignInput } from "../registry";

/** Groups that are about things done after a design is validated. An open item there informs; it does not block. */
const LATER_GROUPS: ReadonlySet<string> = new Set(["proof", "order", "release"]);

/** Every open line of the tech pack's "Ready for the factory" list, as a finding. */
export function readinessFindings(design: DesignInput): readonly Finding[] {
  if (design.readiness === null) return [];
  return design.readiness.groups.flatMap((group) =>
    group.items
      .filter((line) => !line.met)
      .map((line) =>
        finding({
          code: `readiness-${line.id}`,
          severity: LATER_GROUPS.has(group.id) ? "warning" : "blocker",
          article: design.typeId,
          message: `${group.title}: ${line.sentence}`,
          action: line.sentence,
          whoActs: line.whoActs,
        }),
      ),
  );
}
