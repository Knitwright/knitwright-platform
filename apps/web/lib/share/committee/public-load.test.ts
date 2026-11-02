import { describe, expect, it, vi } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { ChartSet } from "@/lib/sizing";
import { loadCommitteePage, type CommitteeLoadDeps } from "./public-load";
import type { OpenCommittee } from "./service";

const NO_CHARTS: ChartSet = { runs: [], charts: [] };
const TOKEN = "t".repeat(43);
const BRAND = "11111111-1111-4111-8111-111111111111";

const opened = (patch: Partial<OpenCommittee> = {}): OpenCommittee => ({
  linkId: "22222222-2222-4222-8222-222222222222",
  brandId: BRAND,
  brandName: "Northside Hockey Club",
  projectName: "Home kit 2027",
  expiresAt: "2026-12-01T00:00:00Z",
  lockedVersion: null,
  options: [
    { slot: "A", version: 4, isCurrent: true, spec: start("crew-tee"), savedAt: "2026-11-01T09:00:00Z" },
    { slot: "B", version: 3, isCurrent: false, spec: start("crew-tee"), savedAt: "2026-10-01T09:00:00Z" },
  ],
  ...patch,
});

const deps = (patch: Partial<CommitteeLoadDeps> = {}): CommitteeLoadDeps => ({
  open: vi.fn(async () => opened()),
  charts: vi.fn(async () => NO_CHARTS),
  reader: vi.fn(() => ({ read: vi.fn(async () => null) }) as unknown as ReturnType<CommitteeLoadDeps["reader"]>),
  shrink: vi.fn(async () => null),
  ...patch,
});

describe("loadCommitteePage", () => {
  it("does not ask the database about a token that could never open a link", async () => {
    const open = vi.fn();

    expect(await loadCommitteePage(deps({ open }), "short")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("is nothing at all for a token that opens no link, so nothing tells the reasons apart", async () => {
    expect(await loadCommitteePage(deps({ open: vi.fn(async () => null) }), TOKEN)).toBeNull();
  });

  it("draws every option the link shows and says which versions they are", async () => {
    const loaded = await loadCommitteePage(deps(), TOKEN);

    expect(loaded?.versions).toEqual([4, 3]);
    expect(loaded?.page.options.map((option) => option.version)).toEqual([4, 3]);
    expect(loaded?.page.designName).toBe("Home kit 2027");
  });

  it("reads the pictures and the charts for the club the token names, never for one a visitor could name", async () => {
    const charts = vi.fn(async () => NO_CHARTS);
    const reader = vi.fn(() => ({ read: vi.fn(async () => null) }) as unknown as ReturnType<CommitteeLoadDeps["reader"]>);
    await loadCommitteePage(deps({ charts, reader }), TOKEN);

    expect(reader).toHaveBeenCalledWith(BRAND);
    expect(charts).toHaveBeenCalledWith(BRAND, undefined);
  });

  it("keeps the charts of the day a version was saved when none of the options is the newest", async () => {
    const charts = vi.fn(async () => NO_CHARTS);
    const older = opened({
      options: [{ slot: "A", version: 2, isCurrent: false, spec: start("crew-tee"), savedAt: "2026-09-01T09:00:00Z" }],
    });
    await loadCommitteePage(deps({ charts, open: vi.fn(async () => older) }), TOKEN);

    expect(charts).toHaveBeenCalledWith(BRAND, "2026-09-01T09:00:00Z");
  });

  it("carries the locked version through, so the page can say the choice is made", async () => {
    const loaded = await loadCommitteePage(deps({ open: vi.fn(async () => opened({ lockedVersion: 3 })) }), TOKEN);

    expect(loaded?.page.lockedNote).toContain("version 3");
    expect(loaded?.page.options[1]?.locked).toBe(true);
  });
});
