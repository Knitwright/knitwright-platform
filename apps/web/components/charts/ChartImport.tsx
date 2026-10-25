"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { importChartAction } from "@/lib/charts/actions";
import type { Grid } from "@/lib/charts/grid";
import type { ChartScreen } from "@/lib/charts/screen";

/*
 * Reading a file and mapping its columns needs the garment rules and zod, which the page does
 * not need to show itself. They load after the page is on screen, before anyone can pick a file.
 */
const loadScreen = () => import("@/lib/charts/screen");
const loadUpload = () => import("@/lib/charts/upload");
const ChartMappingForm = dynamic(() => import("./ChartMappingForm").then((module) => module.ChartMappingForm));

const postFile = (form: FormData): Promise<Response> => fetch("/api/charts/files", { method: "POST", body: form });

type Loaded = Readonly<{ fileId: string; grid: Grid; name: string }>;
type Outcome = Readonly<{ tone: "ok" | "warn"; message: string; problems: readonly string[] }>;

/** Upload a chart file, map its columns, and import it. Every rule lives in lib/charts. */
export function ChartImport() {
  const inputId = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [screen, setScreen] = useState<ChartScreen | null>(null);
  const [busy, setBusy] = useState(false);
  // An import stays pending until the refreshed table is on screen, not only until the action answers.
  const [importing, startImport] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    void loadScreen();
    void loadUpload();
  }, []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setOutcome(null);
    const [{ uploadChart }, { initialScreen }] = await Promise.all([loadUpload(), loadScreen()]);
    const result = await uploadChart(file, postFile);
    setBusy(false);
    if (!result.ok) {
      setOutcome({ tone: "warn", message: result.reason, problems: [] });
      return;
    }
    setLoaded({ fileId: result.fileId, grid: result.grid, name: file.name });
    setScreen(initialScreen(result.suggestion));
  };

  const submit = () => {
    if (!loaded || !screen) return;
    startImport(async () => {
      const mapping = (await loadScreen()).toMapping(screen);
      if (!mapping.ok) {
        setOutcome({ tone: "warn", message: mapping.message, problems: [] });
        return;
      }
      const result = await importChartAction({ fileId: loaded.fileId, mapping: mapping.mapping });
      settle(result);
    });
  };

  const settle = (result: Awaited<ReturnType<typeof importChartAction>>) => {
    if (!result.success) {
      const problems = result.error.fields?.file ?? [];
      setOutcome({ tone: "warn", message: result.error.message, problems: problems.slice(1) });
      return;
    }
    setOutcome({
      tone: "ok",
      message: `Imported. Your chart for ${result.data.garmentType}, ${result.data.wearer}, now has the sizes ${result.data.sizes.join(", ")}.`,
      problems: [],
    });
    // The action revalidates the studio, so its answer already carries the new table.
    setLoaded(null);
    setScreen(null);
  };

  return (
    <section aria-labelledby="import-heading" className="mt-8 rounded-2xl border border-hairline bg-surface p-6">
      <h2 id="import-heading" className="text-base font-semibold text-ink">
        Import a chart
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Upload a CSV or .xlsx file with one row for each point of measure and one column for each size, in centimetres or inches, and
        a tolerance column. Inches may be decimals (20.5) or fractions (20 1/2); the chart is kept in centimetres. Only the first sheet is read. Formulas are never worked out: a cell is read as the value it shows.
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Chart file
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy || importing}
          onChange={(event) => void upload(event.target.files?.[0])}
          className="min-h-10 text-sm text-ink-2"
        />
      </div>
      {outcome ? (
        <div className="mt-4">
          <Notice tone={outcome.tone} role={outcome.tone === "warn" ? "alert" : "status"}>
            <p>{outcome.message}</p>
            {outcome.problems.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {outcome.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </Notice>
        </div>
      ) : null}
      {loaded && screen ? (
        <div className="mt-6">
          <ChartMappingForm grid={loaded.grid} fileName={loaded.name} screen={screen} onChange={setScreen} />
          <div className="mt-6">
            <Button type="button" pending={busy || importing} onClick={submit}>
              Replace the chart with this file
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
