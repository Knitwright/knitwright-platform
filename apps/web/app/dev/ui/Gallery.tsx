"use client";

import { LogoTile } from "@/components/ui/Marks";
import { ButtonsSection } from "./sections/buttons";
import { DataSection } from "./sections/data";
import { FoundationsSection } from "./sections/foundations";
import { InputsSection } from "./sections/inputs";
import { NavigationSection } from "./sections/navigation";
import { OverlaysSection } from "./sections/overlays";
import { StatesSection } from "./sections/states";

const CONTENTS = [
  ["foundations", "Foundations"],
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["navigation", "Tabs, chips and marks"],
  ["overlays", "Menus, popovers, modals, toasts"],
  ["data", "Cards, tables, loading"],
  ["states", "Page states"],
] as const;

/** The component library at /dev/ui: each section shows its components in every §8 and §9 state. */
export function Gallery() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-300 flex-col gap-10 px-10 pt-9 pb-16">
      <header className="flex items-center gap-4">
        <LogoTile />
        <div className="flex flex-col">
          <p className="overline text-muted">Knitwright design system</p>
          <h1 className="text-h1 text-text">Component library</h1>
        </div>
      </header>
      <nav aria-label="Sections" className="flex flex-wrap gap-x-5 gap-y-2">
        {CONTENTS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-body font-medium text-link hover:underline">
            {label}
          </a>
        ))}
      </nav>
      <FoundationsSection />
      <ButtonsSection />
      <InputsSection />
      <NavigationSection />
      <OverlaysSection />
      <DataSection />
      <StatesSection />
    </main>
  );
}
