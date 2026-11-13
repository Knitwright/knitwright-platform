"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import type { StageCallout, StagePoint } from "@/lib/techpack/editor/stage";

/**
 * The marks on the stage (`10` §2 tech pack marks): red circles with white letters for the points of
 * measure, joined by red lines, and blue circles with white numbers for the callouts. Never swapped.
 * Each mark is a button: pressing it selects the matching row of the tables.
 */

export type StageSelection = Readonly<{ kind: "point"; letter: string } | { kind: "callout"; number: number }> | null;

const RADIUS = 10;

type MarkProps = Readonly<{
  x: number;
  y: number;
  text: string;
  label: string;
  tone: "measure" | "callout";
  selected: boolean;
  onPick: () => void;
  testId: string;
}>;

function Mark({ x, y, text, label, tone, selected, onPick, testId }: MarkProps) {
  const press = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPick();
  };
  const click = (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    onPick();
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={click}
      onKeyDown={press}
      className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-gold"
      data-testid={testId}
    >
      <circle
        cx={x}
        cy={y}
        r={selected ? RADIUS + 2 : RADIUS}
        className={cx(tone === "measure" ? "fill-mark-measure" : "fill-mark-callout", selected ? "stroke-gold" : "stroke-bg")}
        strokeWidth={2}
      />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" className="pointer-events-none fill-on-dark text-micro font-bold">
        {text}
      </text>
    </g>
  );
}

type MarksProps = Readonly<{
  points: readonly StagePoint[];
  callouts: readonly StageCallout[];
  selection: StageSelection;
  onSelect: (selection: StageSelection) => void;
}>;

export function StageMarks({ points, callouts, selection, onSelect }: MarksProps) {
  return (
    <>
      {points.map((point) =>
        point.line ? (
          <line
            key={`line-${point.letter}`}
            x1={point.line.from.x}
            y1={point.line.from.y}
            x2={point.line.to.x}
            y2={point.line.to.y}
            className="stroke-mark-measure"
            strokeWidth={1.5}
          />
        ) : null,
      )}
      {points.map((point) => (
        <Mark
          key={`point-${point.letter}`}
          x={point.at.x}
          y={point.at.y}
          text={point.letter}
          label={`Measurement ${point.letter}: ${point.description}`}
          tone="measure"
          selected={selection?.kind === "point" && selection.letter === point.letter}
          onPick={() => onSelect({ kind: "point", letter: point.letter })}
          testId={`tp-point-${point.letter}`}
        />
      ))}
      {callouts.map((callout) =>
        callout.at ? (
          <Mark
            key={`callout-${callout.number}`}
            x={callout.at.x}
            y={callout.at.y}
            text={String(callout.number)}
            label={`Callout ${callout.number}: ${callout.text}`}
            tone="callout"
            selected={selection?.kind === "callout" && selection.number === callout.number}
            onPick={() => onSelect({ kind: "callout", number: callout.number })}
            testId={`tp-callout-${callout.number}`}
          />
        ) : null,
      )}
    </>
  );
}

/** The garment the marks sit on: a front view of a short-sleeve top in the stage's 400 × 480 box. */
export function Garment() {
  return (
    <g aria-hidden="true">
      <path
        d="M150 72 Q200 104 250 72 L302 84 L374 150 L344 212 L290 186 L288 430 L112 430 L110 186 L56 212 L26 150 L98 84 Z"
        className="fill-navy stroke-navy-3"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M150 72 Q200 104 250 72" className="fill-none stroke-gold" strokeWidth={4} />
    </g>
  );
}
