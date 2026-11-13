/** The states the /dev/prompt-bar fixture draws, one per `?show=` (decision 0149). */
export const SHOWS = ["prompt", "video", "ask", "styles", "builder", "prompts", "artboard", "history", "font", "colour", "toast"] as const;
export type Show = (typeof SHOWS)[number];
