import { describe, expect, it, vi } from "vitest";
import { isProvider } from "./sources/source";
import { stubFetch } from "./sources/stubs";
import {
  DEFAULT_INSPIRATION_SETTINGS,
  NO_PINTEREST_LOGINS,
  PINTEREST_NO_LOGIN,
  PINTEREST_OFF,
  pinterestEntry,
  type PinterestAccessReader,
} from "./settings";

/**
 * Pinterest is switched off by a setting, not by a `null` written where the board is built (plan v6 D4, decision
 * 0135). The setting decides first; the key and the person's own login decide after it.
 */

const who = { brandId: "brand-1", userId: "user-1" };
const KEYED = { PINTEREST_APP_ID: "app", NEXT_PUBLIC_INSPIRATION_PINTEREST: "on" };
const login: PinterestAccessReader = { accessFor: vi.fn(async () => ({ accessToken: "token", boardIds: ["b1"] })) };

describe("the Pinterest setting", () => {
  it("is off by default, until Knitwright has a Pinterest app", () => {
    expect(DEFAULT_INSPIRATION_SETTINGS.pinterest).toBe("off");
  });

  it("when off, says so in a sentence and never asks for anyone's login, even with the key set", async () => {
    const reader: PinterestAccessReader = { accessFor: vi.fn(async () => ({ accessToken: "token", boardIds: ["b1"] })) };
    const entry = await pinterestEntry({ pinterest: "off" }, KEYED, reader, who, stubFetch({}));
    expect(isProvider(entry)).toBe(false);
    expect(entry).toEqual({ source: "pinterest-board", unavailable: PINTEREST_OFF });
    expect(reader.accessFor).not.toHaveBeenCalled();
  });

  it("when on but the key or the flag is missing, names the key", async () => {
    const entry = await pinterestEntry({ pinterest: "on" }, {}, login, who, stubFetch({}));
    expect(isProvider(entry)).toBe(false);
    expect("unavailable" in entry && entry.unavailable).toContain("PINTEREST_APP_ID");
  });

  it("when on and keyed but the person has not signed in to Pinterest, says that", async () => {
    const entry = await pinterestEntry({ pinterest: "on" }, KEYED, NO_PINTEREST_LOGINS, who, stubFetch({}));
    expect(entry).toEqual({ source: "pinterest-board", unavailable: PINTEREST_NO_LOGIN });
  });

  it("when on, keyed and signed in, builds the Pinterest source", async () => {
    const entry = await pinterestEntry({ pinterest: "on" }, KEYED, login, who, stubFetch({}));
    expect(isProvider(entry)).toBe(true);
    expect(entry.source).toBe("pinterest-board");
  });

  it("has no login reader in production yet, so nobody's boards are read", async () => {
    expect(await NO_PINTEREST_LOGINS.accessFor(who)).toBeNull();
  });
});
