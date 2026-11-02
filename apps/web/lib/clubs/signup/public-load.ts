import { isShareToken } from "@/lib/share/token";
import type { ChartSet } from "@/lib/sizing";
import { WEARER_GROUPS, WEARER_LABELS, type WearerGroup } from "../wording";
import { NO_SIZES_NOTE } from "./fields";
import { numberHint, type NumberRule } from "./numbers";
import type { OpenSignup } from "./service";
import { guideForWearer, type SizeGuide } from "./size-guide";

/**
 * Reads and draws a sign-up page from a token (spec F-T4, plan v5 Z7, decision 0086).
 *
 * Everything is read for the club the token's link belongs to, never for a club a player names: the
 * season through the token and the club's own size charts. A player is shown the club's name, the
 * season's name, the numbers their sport allows, how long a shirt name may be and the size guide,
 * and nothing else: no other player's answer, no roster, no design and no file.
 */

export interface SignupLoadDeps {
  readonly open: (token: string) => Promise<OpenSignup | null>;
  readonly charts: (brandId: string) => Promise<ChartSet>;
}

export interface SignupCut {
  readonly group: WearerGroup;
  readonly label: string;
  readonly guide: SizeGuide;
}

export interface SignupPageData {
  readonly clubName: string;
  readonly seasonName: string;
  readonly numberRule: NumberRule;
  readonly numberHint: string;
  readonly nameMaxCharacters: number;
  readonly nameRuleId: string;
  readonly cuts: readonly SignupCut[];
  /** The sizes a player may choose, from the club's own size runs. Empty when the club set none. */
  readonly sizes: readonly string[];
  /** One sentence when there is no size to choose, otherwise null. */
  readonly sizesNotice: string | null;
}

export interface LoadedSignupPage {
  readonly page: SignupPageData;
}

/** Every size the club's runs hold, in the order the runs give them, each only once. */
const sizesOf = (charts: ChartSet): readonly string[] => [...new Set(charts.runs.flatMap((run) => run.sizes))];

/** The page for a token, or null when the token opens nothing. */
export async function loadSignupPage(deps: SignupLoadDeps, token: string): Promise<LoadedSignupPage | null> {
  if (!isShareToken(token)) return null;
  const opened = await deps.open(token);
  if (!opened) return null;
  const charts = await deps.charts(opened.brandId);
  const sizes = sizesOf(charts);
  return {
    page: {
      clubName: opened.clubName,
      seasonName: opened.seasonName,
      numberRule: opened.numberRule,
      numberHint: numberHint(opened.numberRule),
      nameMaxCharacters: opened.nameMaxCharacters,
      nameRuleId: opened.nameRuleId,
      cuts: WEARER_GROUPS.map((group) => ({ group, label: WEARER_LABELS[group], guide: guideForWearer(charts, group) })),
      sizes,
      sizesNotice: sizes.length === 0 ? NO_SIZES_NOTE : null,
    },
  };
}
