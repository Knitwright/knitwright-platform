"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FilterChip } from "@/components/ui/Chips";
import { TextInput } from "@/components/ui/Inputs";
import { useToast } from "@/components/ui/Toast";
import { applyKitVariantAction, recolourKitAction, remixKitAction } from "@/lib/ai-studio/actions";
import type { Option } from "@/lib/ai-studio/forms";
import { ERAS, type Era } from "@/lib/ai-studio/eras";
import type { VariantTile } from "@/lib/variants/tiles";
import { FAILED_TOAST, type FramedWorkflow } from "./CanvasWorkflow";
import { FormField, type ProductOption } from "./Fields";
import { VariantResults } from "./VariantResults";
import { GenerateFooter, Step, WorkflowFrame } from "./WorkflowFrame";

/**
 * Retro kit remix and Change kit colour (decision 0141): a design, the answers, and four validated
 * variants drawn as flats, each saved as a new version only when the person picks it. Free: no model
 * is called and nothing is spent.
 */

type Props = Readonly<{
  workflow: FramedWorkflow;
  mode: "remix" | "recolour";
  products: readonly ProductOption[];
  /** The pattern families each garment offers, by garment type. */
  families: Readonly<Record<string, readonly Option[]>>;
}>;

const HEX = /^#[0-9a-f]{6}$/;

function ColourField({ number, label, value, onChange }: Readonly<{ number: number; label: string; value: string; onChange: (value: string) => void }>) {
  const id = useId();
  return (
    <Step number={number} label={label} htmlFor={id}>
      <div className="flex items-center gap-3">
        <input type="color" aria-label={`${label}, picker`} value={HEX.test(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value)} className="h-11 w-14 cursor-pointer rounded-md border border-border bg-bg p-1" />
        <TextInput id={id} value={value} maxLength={7} invalid={!HEX.test(value)} onChange={(event) => onChange(event.target.value.trim().toLowerCase())} className="max-w-40" />
      </div>
    </Step>
  );
}

function useVariantRun(mode: Props["mode"]) {
  const router = useRouter();
  const toast = useToast();
  const [tiles, setTiles] = useState<readonly VariantTile[] | null>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const run = async (ask: Record<string, string>): Promise<void> => {
    setPending(true);
    const reply = mode === "remix" ? await remixKitAction(ask) : await recolourKitAction(ask);
    setPending(false);
    if (!reply.success) return void toast.show({ ...FAILED_TOAST, body: reply.error.message });
    setTiles(reply.data.tiles);
    setVersion(reply.data.version);
  };
  const use = async (ask: Record<string, string>, variantId: string): Promise<void> => {
    setSaving(variantId);
    const reply = await applyKitVariantAction({ ...ask, kind: mode, expectedVersion: version, variantId });
    if (reply.success) return router.push(reply.data.href as Route);
    setSaving(null);
    toast.show({ tone: "error", title: "That design was not saved", body: reply.error.message });
  };
  return { tiles, pending, saving, run, use };
}

export function VariantWorkflow({ workflow, mode, products, families }: Props) {
  const [product, setProduct] = useState("");
  const [era, setEra] = useState<Era>("90s");
  const [family, setFamily] = useState("");
  const [main, setMain] = useState("#0b1f4b");
  const [second, setSecond] = useState("#f2b705");
  const state = useVariantRun(mode);

  const garment = products.find((one) => one.id === product)?.typeId ?? "";
  const offered = families[garment] ?? [];
  const chosenFamily = offered.some((one) => one.value === family) ? family : (offered[0]?.value ?? "");
  const ask: Record<string, string> = mode === "remix" ? { projectId: product, era, family: chosenFamily } : { projectId: product, main, second };
  const blocked =
    product === "" ? "Choose a product first." : mode === "remix" && chosenFamily === "" ? "This garment has no kit patterns to remix." : mode === "recolour" && !(HEX.test(main) && HEX.test(second)) ? "Pick both colours." : null;

  const productField = { kind: "product" as const, id: "product" as const, label: "Pick a product" };
  const footer = <GenerateFooter label="Generate 4" cost="Free" blocked={blocked} pending={state.pending} onGenerate={() => void state.run(ask)} />;
  const after = <VariantResults tiles={state.tiles} pending={state.pending} saving={state.saving} onUse={(id) => void state.use(ask, id)} />;

  return (
    <WorkflowFrame title={workflow.title} lead={workflow.lead} tone={workflow.tone} poweredBy={workflow.poweredBy} footer={footer} after={after} example={4}>
      <div className="flex flex-col gap-8">
        <FormField number={1} field={productField} value={product} products={products} onChange={setProduct} />
        {mode === "remix" ? (
          <>
            <Step number={2} label="Era">
              <div role="group" aria-label="Era" className="flex flex-wrap gap-2">
                {ERAS.map((one) => (
                  <FilterChip key={one} label={one} selected={one === era} onClick={() => setEra(one)} />
                ))}
              </div>
            </Step>
            <Step number={3} label="Pattern family">
              {offered.length === 0 ? (
                <p className="text-body text-muted">{product === "" ? "Choose a product to see the patterns its base offers." : "This garment comes in no kit patterns."}</p>
              ) : (
                <div role="group" aria-label="Pattern family" className="flex flex-wrap gap-2">
                  {offered.map((one) => (
                    <FilterChip key={one.value} label={one.label} selected={one.value === chosenFamily} onClick={() => setFamily(one.value)} />
                  ))}
                </div>
              )}
            </Step>
          </>
        ) : (
          <>
            <ColourField number={2} label="New main colour" value={main} onChange={setMain} />
            <ColourField number={3} label="New second colour" value={second} onChange={setSecond} />
          </>
        )}
        <p className="text-small text-muted">Only colours and the kit pattern change, from the options the base article offers. Every variant is checked against the factory rules before you see it.</p>
      </div>
    </WorkflowFrame>
  );
}
