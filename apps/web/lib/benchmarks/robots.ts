import { BENCHMARK_ROBOTS_NAME } from "./vocabulary";

/**
 * robots.txt, honoured (spec F-S2 step 2). The file is read for our own user agent's group, falling back to `*`, and
 * the longest matching rule decides, with Allow winning a tie (RFC 9309). A robots.txt we cannot read at all is
 * treated as a refusal, because a polite fetcher does not guess.
 */

export type RobotsRules = Readonly<{
  /** The group this came from: our own name, `*`, or null when the file names neither. */
  matchedAgent: string | null;
  allow: readonly string[];
  disallow: readonly string[];
}>;

export const ALL_ALLOWED: RobotsRules = { matchedAgent: null, allow: [], disallow: [] };

const directive = (line: string): readonly [string, string] | null => {
  const withoutComment = line.split("#")[0] ?? "";
  const at = withoutComment.indexOf(":");
  if (at <= 0) return null;
  return [withoutComment.slice(0, at).trim().toLowerCase(), withoutComment.slice(at + 1).trim()];
};

/** The rules for one agent name: its own group when the file has one, else the `*` group. */
export function parseRobots(text: string, agentName: string = BENCHMARK_ROBOTS_NAME): RobotsRules {
  const groups = new Map<string, { allow: string[]; disallow: string[] }>();
  let agents: string[] = [];
  let inGroup = false;
  for (const line of text.split(/\r?\n/)) {
    const pair = directive(line);
    if (!pair) continue;
    const [key, value] = pair;
    if (key === "user-agent") {
      if (inGroup) agents = [];
      agents.push(value.toLowerCase());
      inGroup = false;
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    inGroup = true;
    for (const agent of agents) {
      const group = groups.get(agent) ?? { allow: [], disallow: [] };
      // "Disallow:" with nothing after it allows everything, so it is not a rule.
      if (value !== "") group[key].push(value);
      groups.set(agent, group);
    }
  }
  const name = agentName.toLowerCase();
  const chosen = groups.has(name) ? name : groups.has("*") ? "*" : null;
  const group = chosen === null ? null : groups.get(chosen);
  return group === null || group === undefined ? ALL_ALLOWED : { matchedAgent: chosen, allow: group.allow, disallow: group.disallow };
}

const asPattern = (rule: string): RegExp => {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
};

/** How many characters of the rule matched, or null when it did not match. */
const matchLength = (rule: string, path: string): number | null => (asPattern(rule).test(path) ? rule.replace(/[$]$/, "").length : null);

const longest = (rules: readonly string[], path: string): number =>
  rules.reduce((best, rule) => Math.max(best, matchLength(rule, path) ?? -1), -1);

/** The longest rule wins; a tie goes to Allow, as the standard says. */
export function pathAllowed(rules: RobotsRules, path: string): boolean {
  const reach = path === "" ? "/" : path;
  return longest(rules.allow, reach) >= longest(rules.disallow, reach);
}

/** The answer for one URL. `null` robots.txt means the site has none, which allows everything. */
export function robotsAllows(robotsTxt: string | null, url: string, agentName: string = BENCHMARK_ROBOTS_NAME): boolean {
  const target = new URL(url);
  const rules = robotsTxt === null ? ALL_ALLOWED : parseRobots(robotsTxt, agentName);
  return pathAllowed(rules, `${target.pathname}${target.search}`);
}
