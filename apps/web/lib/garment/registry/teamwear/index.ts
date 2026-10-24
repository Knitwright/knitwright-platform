import type { FamilyData } from "../../definitions";
import { BOTTOMS_COMPONENTS, BOTTOMS_SEAMS } from "../bottoms/construction";
import { BOTTOMS_OPTIONS, BOTTOMS_RULES } from "../bottoms/options";
import { BOTTOMS_PANELS } from "../bottoms/panels";
import { BOTTOMS_POINTS_OF_MEASURE } from "../bottoms/points-of-measure";
import { TOPS_COMPONENTS, TOPS_SEAMS } from "../tops/construction";
import { TOPS_OPTIONS } from "../tops/options";
import { TOPS_PANELS } from "../tops/panels";
import { TOPS_POINTS_OF_MEASURE } from "../tops/points-of-measure";
import { TOPS_RULES } from "../tops/rules";
import { composeFamily, EMPTY_KIT, type Kit } from "./compose";
import { CAP_COMPONENTS, CAP_SEAMS, KEEPER_COMPONENTS, SOCK_COMPONENTS, SOCK_SEAMS } from "./construction";
import { CAP_ADJUSTER, CAP_SHAPE, ELBOW_PADS, KEEPER_RULES, SOCK_HEIGHT, SOCK_TOP, WINTER_CODE as WINTER_CODE_OPTION } from "./options";
import { CAP_PANELS, SOCK_PANELS } from "./panels";
import { CAP_POINTS_OF_MEASURE, SOCK_POINTS_OF_MEASURE } from "./points-of-measure";
import { CRICKET_TYPES, FOOTBALL_TYPES, WINTER_CODE_TYPES } from "./types";

/** What a shirt brings: the tops family as it is. Listed first in every family, so its wording wins. */
const TOPS_KIT: Kit = {
  options: TOPS_OPTIONS,
  pointsOfMeasure: TOPS_POINTS_OF_MEASURE,
  panels: TOPS_PANELS,
  rules: TOPS_RULES,
  seams: TOPS_SEAMS,
  components: TOPS_COMPONENTS,
};

/** What shorts and trousers bring: the bottoms family as it is. */
const BOTTOMS_KIT: Kit = {
  options: BOTTOMS_OPTIONS,
  pointsOfMeasure: BOTTOMS_POINTS_OF_MEASURE,
  panels: BOTTOMS_PANELS,
  rules: BOTTOMS_RULES,
  seams: BOTTOMS_SEAMS,
  components: BOTTOMS_COMPONENTS,
};

const KEEPER_KIT: Kit = { ...EMPTY_KIT, options: [ELBOW_PADS], rules: KEEPER_RULES, components: KEEPER_COMPONENTS };
const SOCKS_KIT: Kit = {
  ...EMPTY_KIT,
  options: [SOCK_HEIGHT, SOCK_TOP],
  pointsOfMeasure: SOCK_POINTS_OF_MEASURE,
  panels: SOCK_PANELS,
  seams: SOCK_SEAMS,
  components: SOCK_COMPONENTS,
};
const CAP_KIT: Kit = {
  ...EMPTY_KIT,
  options: [CAP_SHAPE, CAP_ADJUSTER],
  pointsOfMeasure: CAP_POINTS_OF_MEASURE,
  panels: CAP_PANELS,
  seams: CAP_SEAMS,
  components: CAP_COMPONENTS,
};
const WINTER_KIT: Kit = { ...EMPTY_KIT, options: [WINTER_CODE_OPTION] };

/** Football: shirts, shorts, socks, the goalkeeper shirt and the training top. */
export const FOOTBALL: FamilyData = composeFamily("football", "Football", [TOPS_KIT, BOTTOMS_KIT, KEEPER_KIT, SOCKS_KIT], FOOTBALL_TYPES);

/** Cricket: the coloured shirt, trousers, training tee and cap. */
export const CRICKET: FamilyData = composeFamily("cricket", "Cricket", [TOPS_KIT, BOTTOMS_KIT, CAP_KIT], CRICKET_TYPES);

/** The Australian winter code: one team top until the partner picks the code. */
export const WINTER_CODE: FamilyData = composeFamily("winter-code", "Winter code (Australia)", [TOPS_KIT, WINTER_KIT], WINTER_CODE_TYPES);

/** The three sport families, in the order the start screen lists them. */
export const TEAMWEAR_FAMILIES: readonly FamilyData[] = [FOOTBALL, CRICKET, WINTER_CODE];

/** Every teamwear article id. The start screen offers these, and the pattern library has a slot for each. */
export const TEAMWEAR_TYPE_IDS: readonly string[] = TEAMWEAR_FAMILIES.flatMap((family) => family.types.map((type) => type.id));
