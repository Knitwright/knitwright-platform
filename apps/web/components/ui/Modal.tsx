"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { FOCUSABLE, trapIndex } from "./keys";

/**
 * A modal (docs/spec/10-design-system.md §8). Small 480, medium 720, large 960, sheet preview
 * 1320 px wide; at most 92% of the window high; r-3xl, e4, over a `scrim` backdrop. The header is
 * an h2 with × at the top right (a 40 px target); the footer is right-aligned, secondary then
 * primary.
 *
 * Focus is trapped inside. On open it goes to the element marked `data-autofocus`, else the
 * first input, else the button marked `data-primary`, else ×; on close it goes back where it
 * was. Esc closes, unless `dirty`: then it asks "Discard changes?" first.
 */

export type ModalSize = "sm" | "md" | "lg" | "sheet";

const WIDTHS: Readonly<Record<ModalSize, string>> = {
  sm: "max-w-120",
  md: "max-w-180",
  lg: "max-w-240",
  sheet: "max-w-330",
};

type ModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  /** The form inside holds input that closing would lose. */
  dirty?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}>;

export function Modal(props: ModalProps) {
  return props.open ? <ModalFrame {...props} /> : null;
}

/** Where focus goes when the modal opens. */
export const initialFocus = (box: HTMLElement): HTMLElement | null =>
  box.querySelector<HTMLElement>("[data-autofocus]") ??
  box.querySelector<HTMLElement>("input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])") ??
  box.querySelector<HTMLElement>("[data-primary]") ??
  box.querySelector<HTMLElement>(FOCUSABLE);

/** Keeps Tab inside the box. */
export function trapTab(event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">, box: HTMLElement, active: Element | null) {
  if (event.key !== "Tab") return;
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const next = trapIndex(items.indexOf(active as HTMLElement), items.length, event.shiftKey);
  if (next === null) return;
  event.preventDefault();
  items[next].focus();
}

function useModalFocus(box: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (box.current) initialFocus(box.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [box]);
}

function ModalFrame({ onClose, title, size = "sm", dirty = false, footer, children }: ModalProps) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  useModalFocus(box);
  const requestClose = () => (dirty ? setConfirming(true) : onClose());
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (confirming) setConfirming(false);
      else requestClose();
      return;
    }
    if (box.current) trapTab(event, box.current, document.activeElement);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim motion-safe:fade-in" onClick={requestClose} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-bg text-text shadow-e4 motion-safe:modal-in",
          WIDTHS[size],
        )}
      >
        <header className="flex items-start gap-4 px-6 pt-6 pb-4">
          <h2 id={titleId} className="flex-1 text-h2 text-text">
            {title}
          </h2>
          <Button variant="ghost" iconOnly aria-label="Close" icon={<Icon icon={X} />} onClick={requestClose} className="-mt-1 -mr-2" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {confirming ? (
          <DiscardBar onKeep={() => setConfirming(false)} onDiscard={onClose} />
        ) : footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

function DiscardBar({ onKeep, onDiscard }: Readonly<{ onKeep: () => void; onDiscard: () => void }>) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);
  return (
    <footer role="alertdialog" aria-label="Discard changes?" className="flex items-center justify-end gap-2 border-t border-border bg-warn-soft px-6 py-4">
      <p className="mr-auto text-body font-semibold text-text">Discard changes?</p>
      <Button ref={keep} variant="secondary" onClick={onKeep}>
        Keep editing
      </Button>
      <Button variant="danger" onClick={onDiscard}>
        Discard
      </Button>
    </footer>
  );
}
