import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAN_SETTINGS, type PlanRow } from "./catalogue";
import { createPlansStore, planIdFromName } from "./modal-store";
import {
  bestSaving,
  bestSavingPercent,
  creditsView,
  currentPlanLine,
  money,
  planNamed,
  plansOf,
  priceView,
  techPackLine,
  yearlySaving,
} from "./view";

const starter = planNamed("starter");
const pro = planNamed("studio_pro");
const club = planNamed("club_scale");
const free = planNamed("free");

describe("the plan rows", () => {
  it("are labelled placeholders, with the free plan current until C1", () => {
    expect(PLAN_SETTINGS.isPlaceholder).toBe(true);
    expect(PLAN_SETTINGS.currentPlan).toBe("free");
  });

  it("name only plans that exist, and highlight exactly one of the plans the modal chooses from", () => {
    expect(plansOf(PLAN_SETTINGS.choosePlans).map((p) => p.id)).toEqual(["starter", "studio_pro", "club_scale"]);
    expect(plansOf(PLAN_SETTINGS.techPackPlans).map((p) => p.id)).toEqual(["free", "starter", "studio_pro"]);
    expect(plansOf(PLAN_SETTINGS.choosePlans).filter((p) => p.highlighted)).toHaveLength(1);
    expect(() => planNamed("nope" as never)).toThrow();
  });

  it("never charge more annually than monthly", () => {
    for (const plan of PLAN_SETTINGS.plans) expect(plan.annualMonthlyMinor).toBeLessThanOrEqual(plan.monthlyMinor);
  });
});

describe("prices", () => {
  it("write whole pounds without pence, and pence when there are some", () => {
    expect(money(700)).toBe("£7");
    expect(money(2350)).toBe("£23.50");
    expect(money(19200)).toBe("£192");
  });

  it("strike the monthly price through on annual billing and say what a year saves", () => {
    expect(priceView(starter, "annual")).toEqual({ now: "£7", was: "£9", per: "/mo, billed annually", saving: "£24" });
    expect(priceView(pro, "annual").saving).toBe("£72");
    expect(priceView(club, "annual").saving).toBe("£192");
    expect(priceView(starter, "monthly")).toEqual({ now: "£9", was: null, per: "/mo, billed monthly", saving: null });
  });

  it("call the free plan free forever", () => {
    expect(priceView(free, "annual")).toEqual({ now: "£0", was: null, per: "forever", saving: null });
  });

  it("find the best saving for the pill, and as a percentage for the tech pack modal", () => {
    expect(yearlySaving(starter)).toBe(2400);
    expect(bestSaving(plansOf(PLAN_SETTINGS.choosePlans))).toBe(19200);
    expect(bestSavingPercent(plansOf(PLAN_SETTINGS.techPackPlans))).toBe(22);
    expect(bestSaving([])).toBe(0);
  });

  it("show no struck price when annual saves nothing", () => {
    const flat: PlanRow = { ...starter, annualMonthlyMinor: starter.monthlyMinor };
    expect(priceView(flat, "annual")).toMatchObject({ was: null, saving: null });
  });
});

describe("credits and limits", () => {
  it("say what a month of credits makes", () => {
    expect(creditsView(starter)).toEqual({ amount: "600 AI credits", per: "/mo", makes: "Up to 120 images or 6 videos" });
    expect(creditsView(club).makes).toBe("Up to 1,600 images or 80 videos");
    expect(creditsView(free).per).toBe("to start");
  });

  it("name the tech pack exports, or none", () => {
    expect(techPackLine(free)).toBeNull();
    expect(techPackLine(starter)).toBe("5 tech pack exports / month");
    expect(techPackLine(club)).toBe("Unlimited tech pack exports");
  });

  it("say the current plan and the balance for Settings", () => {
    expect(currentPlanLine(1240)).toBe("Free · 1,240 credits left");
    expect(currentPlanLine(null)).toBe("Free");
  });
});

describe("the plans modal store", () => {
  it("opens on Choose Your Plan by default, tells its listeners, and starts fresh each time", () => {
    const store = createPlansStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.open();
    expect(store.current()).toEqual({ kind: "plans", plan: null, serial: 1 });
    store.open({ kind: "techpack", plan: "starter" });
    expect(store.current()).toEqual({ kind: "techpack", plan: "starter", serial: 2 });
    store.close();
    store.close();
    expect(store.current()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    store.open();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("reads the plan a ♛ gate names", () => {
    expect(planIdFromName("Studio Pro")).toBe("studio_pro");
    expect(planIdFromName(" starter ")).toBe("starter");
    expect(planIdFromName("Club & Scale")).toBe("club_scale");
    expect(planIdFromName("Free")).toBe("free");
    expect(planIdFromName("Gold")).toBeNull();
  });
});

describe("no price is a literal outside the plan rows", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  it("in the plans components", () => {
    const files = walk(join(__dirname, "..", "..", "components", "plans")).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/£\d/);
  });
});
