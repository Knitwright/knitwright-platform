"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { importChartAction } from "@/lib/charts/actions";
import type { Grid } from "@/lib/charts/grid";
import { initialScreen, toMapping, type ChartScreen } from "@/lib/charts/screen";
import { uploadChart } from "@/lib/charts/upload";
import { ChartMappingForm } from "./ChartMappingForm";

const postFile = (form: FormData): Promise<Response> => fetch("/api/charts/files", { method: "POST", body: form });

type Loaded = Readonly<{ fileId: string; grid: Grid; name: string }>;
type Outcome = Readonly<{ tone: "ok" | "warn"; message: string; problems: readonly string[] }>;

/** Upload a chart file, map its columns, and import it. Every rule lives in lib/charts. */
export function ChartImport() {
  const router = useRouter();
  const inputId = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [screen, setScreen] = useState<ChartScreen | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setOutcome(null);
    const result = await uploadChart(file, postFile);
    setBusy(false);
    if (!result.ok) {
      setOutcome({ tone: "warn", message: result.reason, problems: [] });
      return;
    }
    setLoaded({ fileId: result.fileId, grid: result.grid, name: file.name });
    setScreen(initialScreen(result.suggestion));
  };

  const submit = async () => {
    if (!loaded || !screen) return;
    const mapping = toMapping(screen);
    if (!mapping.ok) {
      setOutcome({ tone: "warn", message: mapping.message, problems: [] });
      return;
    }
    setBusy(true);
    const result = await importChartAction({ fileId: loaded.fileId, mapping: mapping.mapping });
    setBusy(false);
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
    setLoaded(null);
    setScreen(null);
    router.refresh();
  };

  return (
    <section aria-labelledby="import-heading" className="mt-8 rounded-2xl border border-hairline bg-surface p-6">
      <h2 id="import-heading" className="text-base font-semibold text-ink">
        Import a chart
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Upload a CSV or .xlsx file with one row for each point of measure and one column for each size, in centimetres, and
        a tolerance column. Only the first sheet is read. Formulas are never worked out: a cell is read as the value it shows.
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Chart file
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
          className="text-sm text-ink-2"
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
            <Button type="button" pending={busy} onClick={() => void submit()}>
              Replace the chart with this file
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
