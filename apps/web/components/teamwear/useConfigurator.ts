"use client";

import { useCallback, useMemo, useState } from "react";
import type { BaseArticle } from "@/lib/catalogue";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { Wearer } from "@/lib/garment";
import type { PriceSource } from "@/lib/home/price";
import {
  applyBundle,
  articleOf,
  chooseOption,
  chooseParameter,
  clampQuantity,
  kitPrice,
  panelRows,
  partDone,
  partOf,
  partPreview,
  partsForSport,
  pushHistory,
  quantityFloor,
  redo,
  settleEverywhere,
  startHistory,
  undo,
  canRedo,
  canUndo,
  settle,
  sportById,
  withPart,
  startingKit,
  COLOURS_ROW,
  MODEL_ROW,
  NAMES_ROW,
  ELEMENTS_ROW,
  type ElementSlotId,
  type KitBundleId,
  type KitPartId,
  type TeamwearKit,
} from "@/lib/teamwear";

/**
 * The configurator's state: the kit, its undo stack, and the one part the panel is showing.
 *
 * Every change goes through `pushHistory`, so the rail's undo and redo work on whole kits, and every
 * change to an option or a parameter goes through the base article, so a value the factory does not
 * make never reaches the kit. Nothing is stored until Save.
 */

export interface ConfiguratorInput {
  readonly sportId: string;
  readonly part: KitPartId;
  readonly articles: readonly BaseArticle[];
  readonly sources: Readonly<Record<string, PriceSource>>;
  readonly currency: SellCurrency;
  readonly factoryName: string | null;
}

const NO_LADDER: PriceSource = { ladder: [], moq: null };

export function useConfigurator(input: ConfiguratorInput) {
  const articles = useMemo(() => new Map(input.articles.map((article) => [article.code, article] as const)), [input.articles]);
  const [history, setHistory] = useState(() => startHistory(startingKit(input.sportId, articles)));
  const [part, setPart] = useState<KitPartId>(input.part);
  const [bundleProblem, setBundleProblem] = useState<string | null>(null);
  const kit = history.present;

  const change = useCallback((next: TeamwearKit) => setHistory((current) => pushHistory(current, next)), []);
  const sport = sportById(kit.sportId);
  const current = partOf(sport, part) ?? partsForSport(sport)[0]!;
  const choice = kit.parts[current.id]!;
  const article = articleOf(current, articles);

  const rows = useMemo(() => panelRows(kit, current, article, choice), [kit, current, article, choice]);
  const price = useMemo(
    () => kitPrice(kit, (code) => input.sources[code] ?? NO_LADDER, input.currency, input.factoryName),
    [kit, input.sources, input.currency, input.factoryName],
  );
  const preview = useMemo(() => partPreview(kit, current, choice, kit.wearer), [kit, current, choice]);

  const pills = useMemo(
    () =>
      partsForSport(sport).map((entry) => ({
        id: entry.id,
        label: entry.label,
        done: partDone(panelRows(kit, entry, articleOf(entry, articles), kit.parts[entry.id]!)),
      })),
    [kit, sport, articles],
  );

  const handlers = useMemo(
    () => ({
      setWearer: (wearer: Wearer) => change(settleEverywhere({ ...kit, wearer }, MODEL_ROW)),
      setColour: (role: "main" | "second" | "third" | "socks", swatch: string | null) => {
        if (role === "socks") return change(settleEverywhere({ ...kit, socksColour: swatch ?? kit.socksColour, bundleId: null }, COLOURS_ROW));
        if (role === "third") return change(settleEverywhere({ ...kit, colours: { ...kit.colours, third: swatch }, bundleId: null }, COLOURS_ROW));
        if (swatch === null) return;
        return change(settleEverywhere({ ...kit, colours: { ...kit.colours, [role]: swatch }, bundleId: null }, COLOURS_ROW));
      },
      setOption: (group: string, code: string) => change(withPart(kit, current.id, (entry) => chooseOption(entry, article, group, code, `option:${group}`))),
      setParameter: (key: string, mm: number) => change(withPart(kit, current.id, (entry) => chooseParameter(entry, article, key, mm, "parameters"))),
      setElement: (slot: ElementSlotId, filled: boolean) =>
        change(
          settleEverywhere(
            { ...kit, elements: filled ? [...kit.elements, slot] : kit.elements.filter((entry) => entry !== slot) },
            ELEMENTS_ROW,
          ),
        ),
      setNamesNumbers: (on: boolean) => change(settleEverywhere({ ...kit, namesNumbers: on }, NAMES_ROW)),
    }),
    [kit, current.id, article, change],
  );

  const setQuantity = useCallback(
    (wanted: number) => {
      const floor = quantityFloor(current.articleCode === null ? null : input.sources[current.articleCode] ?? NO_LADDER);
      change(withPart(kit, current.id, (entry) => settle({ ...entry, quantity: clampQuantity(wanted, floor) }, "quantity")));
    },
    [kit, current, input.sources, change],
  );

  const chooseBundle = useCallback(
    (bundle: KitBundleId) => {
      const applied = applyBundle(kit, bundle, kit.colours);
      setBundleProblem(applied.ok ? null : applied.reason);
      if (applied.ok) change(applied.kit);
    },
    [kit, change],
  );

  return {
    kit,
    part: current,
    choice,
    article,
    rows,
    price,
    preview,
    pills,
    handlers,
    setQuantity,
    chooseBundle,
    bundleProblem,
    floor: quantityFloor(current.articleCode === null ? null : input.sources[current.articleCode] ?? NO_LADDER),
    showPart: setPart,
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
