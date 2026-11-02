import { describe, expect, it } from "vitest";
import { PLAYER_HINT } from "./copy";
import { applyPlayer, initialPlayer, mayAutoplay, muteLabel, playerKey, playLabel, scrubTo, STEP_MS, timeLabel } from "./player";

const state = (durationMs = 9000) => initialPlayer(durationMs);

describe("the player", () => {
  it("starts paused and muted, so nothing ever plays sound at somebody", () => {
    expect(state()).toEqual({ playing: false, muted: true, atMs: 0, durationMs: 9000 });
    expect(mayAutoplay(state())).toBe(true);
    expect(mayAutoplay(applyPlayer(state(), "mute"))).toBe(false);
  });

  it("never has a negative length, whatever it is given", () => {
    expect(initialPlayer(-5).durationMs).toBe(0);
  });

  it("plays and pauses, and says which it would do next", () => {
    const playing = applyPlayer(state(), "toggle");
    expect(playing.playing).toBe(true);
    expect(playLabel(playing)).toBe("Pause");
    expect(playLabel(applyPlayer(playing, "toggle"))).toBe("Play");
    expect(applyPlayer(state(), "play").playing).toBe(true);
    expect(applyPlayer(playing, "pause").playing).toBe(false);
  });

  it("mutes and unmutes, and says which it would do next", () => {
    const loud = applyPlayer(state(), "mute");
    expect(loud.muted).toBe(false);
    expect(muteLabel(loud)).toBe("Turn sound off");
    expect(muteLabel(state())).toBe("Turn sound on");
  });

  it("moves a second at a time and stops at both ends", () => {
    const forward = applyPlayer(state(), "forward");
    expect(forward.atMs).toBe(STEP_MS);
    expect(applyPlayer(state(), "back").atMs).toBe(0);
    expect(applyPlayer({ ...state(), atMs: 8800 }, "forward").atMs).toBe(9000);
  });

  it("jumps to the ends, and stops playing at the end", () => {
    expect(applyPlayer({ ...state(), atMs: 4000 }, "start").atMs).toBe(0);
    expect(applyPlayer({ ...state(), playing: true }, "end")).toMatchObject({ atMs: 9000, playing: false });
  });

  it("does everything from the keyboard, and the hint says which keys", () => {
    expect(playerKey(" ")).toBe("toggle");
    expect(playerKey("k")).toBe("toggle");
    expect(playerKey("K")).toBe("toggle");
    expect(playerKey("m")).toBe("mute");
    expect(playerKey("ArrowLeft")).toBe("back");
    expect(playerKey("ArrowRight")).toBe("forward");
    expect(playerKey("Home")).toBe("start");
    expect(playerKey("End")).toBe("end");
    expect(playerKey("q")).toBeNull();
    for (const word of ["Space", "K", "arrow", "M"]) expect(PLAYER_HINT).toContain(word);
  });

  it("holds the scrubber inside the clip, whatever it is dragged to", () => {
    expect(scrubTo(state(), 4000).atMs).toBe(4000);
    expect(scrubTo(state(), -1).atMs).toBe(0);
    expect(scrubTo(state(), 99_000).atMs).toBe(9000);
    expect(scrubTo(state(), Number.NaN).atMs).toBe(0);
  });

  it("reads the position out as a time a screen reader can say", () => {
    expect(timeLabel(state())).toBe("00:00 / 00:09");
    expect(timeLabel({ ...state(), atMs: 3500 })).toBe("00:03 / 00:09");
  });
});
