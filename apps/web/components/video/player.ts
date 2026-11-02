import { clock } from "@/lib/media/video/formats";

/**
 * The player bar of a clip board (spec F-L3: "play, scrubber, mute, Flatten, download"), as a value.
 *
 * Two accessibility rules are built into the state rather than left to the markup:
 *
 *   * **nothing autoplays with sound.** The first state is paused and muted, and `mayAutoplay` is
 *     true only while the clip is muted, so a clip can never start talking at somebody;
 *   * **the keyboard does everything the mouse does.** Space and K play and pause, the arrow keys
 *     move a second at a time, Home and End jump to the ends, M mutes. The hint that says so is in
 *     `copy.ts` and is shown next to the bar.
 */

export interface PlayerState {
  readonly playing: boolean;
  readonly muted: boolean;
  readonly atMs: number;
  readonly durationMs: number;
}

/** Paused and muted: a clip never starts playing at somebody, and never with sound. */
export const initialPlayer = (durationMs: number): PlayerState => ({ playing: false, muted: true, atMs: 0, durationMs: Math.max(0, durationMs) });

export const PLAYER_COMMANDS = ["toggle", "play", "pause", "mute", "back", "forward", "start", "end"] as const;
export type PlayerCommand = (typeof PLAYER_COMMANDS)[number];

/** One second a press: the step the spec's own scrubber implies, and small enough to be useful. */
export const STEP_MS = 1000;

const KEYS: Readonly<Record<string, PlayerCommand>> = {
  " ": "toggle",
  Spacebar: "toggle",
  k: "toggle",
  K: "toggle",
  m: "mute",
  M: "mute",
  ArrowLeft: "back",
  ArrowRight: "forward",
  Home: "start",
  End: "end",
};

/** The command a key press stands for, or null for a key the player does not use. */
export const playerKey = (key: string): PlayerCommand | null => KEYS[key] ?? null;

const clamp = (ms: number, durationMs: number): number => Math.min(Math.max(0, ms), durationMs);

/** The state after a command. Pure, so the player's behaviour is tested without a browser. */
export function applyPlayer(state: PlayerState, command: PlayerCommand): PlayerState {
  switch (command) {
    case "toggle":
      return { ...state, playing: !state.playing };
    case "play":
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "mute":
      return { ...state, muted: !state.muted };
    case "back":
      return { ...state, atMs: clamp(state.atMs - STEP_MS, state.durationMs) };
    case "forward":
      return { ...state, atMs: clamp(state.atMs + STEP_MS, state.durationMs) };
    case "start":
      return { ...state, atMs: 0 };
    case "end":
      return { ...state, atMs: state.durationMs, playing: false };
  }
}

/** Where the scrubber was dragged to, held inside the clip. */
export const scrubTo = (state: PlayerState, ms: number): PlayerState => ({ ...state, atMs: clamp(Number.isFinite(ms) ? ms : 0, state.durationMs) });

/** "00:03 / 00:09", the same words a screen reader is given for the scrubber. */
export const timeLabel = (state: PlayerState): string => `${clock(state.atMs / 1000)} / ${clock(state.durationMs / 1000)}`;

/** A clip may start on its own only while it is muted. */
export const mayAutoplay = (state: PlayerState): boolean => state.muted;

export const playLabel = (state: PlayerState): string => (state.playing ? "Pause" : "Play");
export const muteLabel = (state: PlayerState): string => (state.muted ? "Turn sound on" : "Turn sound off");
