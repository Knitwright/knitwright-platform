import type { FactoryProfile } from "@/lib/validation/profile";

/**
 * The colour tolerance a reading is judged against (plan v5 O1, decision 0100).
 *
 * A factory's tolerance is agreed per fabric (`factory_capabilities.colour_delta_max`, rule R-SUB-005), and an
 * ops order names its fabric by the Store's own key, which does not map to a programme fabric code yet. So the
 * limit is taken only where the factory holds the *same* tolerance on every fabric it makes: then nothing is
 * being guessed about which one applies. Anything else is "not on file", the reading is still recorded, and
 * nothing says whether it passes. That mapping is an owner question on this PR, not a number to invent.
 */

export function colourLimitOf(profile: Pick<FactoryProfile, "fabrics">): number | null {
  const set = profile.fabrics.map((f) => f.colourDelta).filter((d) => d.status === "set");
  const values = [...new Set(set.map((d) => (d.status === "set" ? d.value : 0)))];
  return set.length === profile.fabrics.length && values.length === 1 ? (values[0] ?? null) : null;
}

/** Why no limit was taken, in words a reader can act on. Null when one was. */
export function colourLimitProblem(profile: Pick<FactoryProfile, "fabrics">): string | null {
  if (colourLimitOf(profile) !== null) return null;
  if (profile.fabrics.length === 0) return "This factory has no fabric on file, so it has no colour tolerance to judge a reading against.";
  const unset = profile.fabrics.filter((f) => f.colourDelta.status === "not-set").map((f) => f.name);
  if (unset.length > 0) return `No colour tolerance is agreed for ${unset.join(", ")}, so a reading is recorded and nothing judges it.`;
  return "This factory holds a different colour tolerance on each fabric, and an order does not yet say which fabric row it was made on, so a reading is recorded and nothing judges it.";
}
