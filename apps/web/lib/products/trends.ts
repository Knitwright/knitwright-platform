import type { Route } from "next";
import { SPORT_LABELS, SPORTS, STYLE_LABELS, type Sport } from "@/lib/templates/catalogue";
import type { TemplateSummary } from "@/lib/templates/filters";
import { TRENDS_PATH } from "./routes";

/**
 * Trending ideas (09 screen 26, v3.5; prototype p08): sport chips and a masonry of ideas, each opening the editor.
 *
 * The ideas are Knitwright's own design templates, the library the inspiration board draws on (F-S1, decision
 * 0082), so every picture is ours and drawn by our renderer. Nothing records what is trending, so the page does not
 * rank or claim it: it says these are ideas from the library, by sport. Opening one makes a copy in the brand
 * through the template library's own action, exactly as the Templates page does.
 */

export const TRENDS_LIMIT = 24;

export interface SportChip {
  readonly id: Sport | "all";
  readonly label: string;
  readonly count: number;
  readonly href: Route;
}

export const sportFromQuery = (value: string | readonly string[] | undefined): Sport | "all" => {
  const asked = Array.isArray(value) ? value[0] : value;
  return SPORTS.find((sport) => sport === asked) ?? "all";
};

/** "All", then each sport some template is for, with its count. */
export function sportChips(templates: readonly TemplateSummary[]): readonly SportChip[] {
  const all: SportChip = { id: "all", label: "All", count: templates.length, href: TRENDS_PATH };
  const sports = SPORTS.map((sport) => ({
    id: sport,
    label: SPORT_LABELS[sport],
    count: templates.filter((template) => template.sport === sport).length,
    href: `${TRENDS_PATH}?sport=${sport}` as Route,
  })).filter((chip) => chip.count > 0);
  return [all, ...sports];
}

export interface IdeaTile {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  /** Which of three heights the masonry gives the tile, so the columns stagger. */
  readonly height: "short" | "medium" | "tall";
  readonly tone: "navy" | "soft" | "gold" | "dark" | "electric";
}

const HEIGHTS: readonly IdeaTile["height"][] = ["short", "tall", "medium", "medium", "short", "tall"];
const TONES: readonly IdeaTile["tone"][] = ["navy", "soft", "gold", "electric", "dark"];

/** The ideas for a sport, at most `TRENDS_LIMIT`, each with its place in the masonry. */
export function ideaTiles(templates: readonly TemplateSummary[], sport: Sport | "all"): readonly IdeaTile[] {
  return templates
    .filter((template) => sport === "all" || template.sport === sport)
    .slice(0, TRENDS_LIMIT)
    .map((template, index) => ({
      id: template.id,
      title: template.title,
      caption: `${SPORT_LABELS[template.sport]} · ${STYLE_LABELS[template.style]}`,
      height: HEIGHTS[index % HEIGHTS.length]!,
      tone: TONES[index % TONES.length]!,
    }));
}
