import type { FocusEventHandler, KeyboardEventHandler, MouseEventHandler, ReactNode, RefObject } from "react";

type Props = Readonly<{
  rail: ReactNode;
  flyout: ReactNode;
  /** Notes over the top of the canvas: the read-only notice and the shell's last word. */
  notices: ReactNode;
  canvas: ReactNode;
  taskBar: ReactNode;
  prompt: ReactNode;
  dock: ReactNode;
  right: ReactNode;
  stage: RefObject<HTMLDivElement | null>;
  onFocus: FocusEventHandler<HTMLDivElement>;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}>;

/**
 * THE EDITOR'S FRAME (plan v6 E2, decision 0146; `08` §5.1, prototype e01): the 76 px rail, the
 * 320 px flyout, the canvas with the task bar floating over it and the prompt pill and dock at its
 * foot, and the 310 px right panel -- the whole window, with no dashboard top bar over it
 * (`globals.css`, "the editor fills the window").
 *
 * Below `lg` the editor is not the Kittl layout (`10` §4 gives it a 1280 px minimum), but it is still
 * usable: the canvas comes first, the flyout and the right panel stack under it, and the rail is a
 * bar along the bottom of the screen, as the launch shell's was.
 */
export function EditorLayout({ rail, flyout, notices, canvas, taskBar, prompt, dock, right, stage, onFocus, onContextMenu, onKeyDown }: Props) {
  return (
    <div data-testid="launch-shell" data-editor-chrome="" className="flex w-full flex-col bg-soft-2 pb-24 lg:h-dvh lg:flex-row lg:overflow-hidden lg:pb-0">
      {rail}
      {flyout}
      <div
        ref={stage}
        onFocus={onFocus}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        className="relative order-first flex h-[80dvh] min-w-0 flex-col overflow-hidden lg:order-none lg:h-auto lg:flex-1"
        data-testid="editor-stage"
      >
        <div className="pointer-events-none absolute inset-x-4 top-3 z-40 flex flex-col items-center gap-2 [&>*]:pointer-events-auto">{notices}</div>
        {canvas}
        {taskBar}
        <div className="pointer-events-none absolute inset-x-4 bottom-3 z-30 flex flex-col items-center gap-2.5">
          {prompt}
          {dock}
        </div>
      </div>
      {right}
    </div>
  );
}
