"use client";

import { Briefcase, Grid3x3, Heart, Image as ImageIcon, MessageCircle, Users, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { PRODUCT } from "@/lib/config/product";
import { MORE_APPS, SHORTCUT_ROWS, type Flyout, type MoreApp } from "@/lib/editor-chrome";
import { helpHref } from "@/lib/shell/menus";

/**
 * Three of the editor's own flyouts (decision 0146): **More** (prototype e10), **Learn** (e11) and
 * **Help**. Each lists only what does something: an app opens its launch panel or its page, a
 * lesson opens the flyout it is about, and Help lists the shortcuts that really work and a way to
 * write to us.
 */

const ICONS: Readonly<Record<MoreApp["id"], LucideIcon>> = {
  photos: ImageIcon,
  chat: MessageCircle,
  likes: Heart,
  brand: Briefcase,
  textures: Grid3x3,
  team: Users,
};

const ROW = "flex w-full items-center gap-3.5 rounded-xl border border-border p-2.5 text-left no-underline hover:bg-soft";

function AppRow({ app, children }: Readonly<{ app: MoreApp; children: ReactNode }>) {
  return (
    <>
      <span className="grid size-18 shrink-0 place-items-center rounded-lg border border-border text-text-2">
        <Icon icon={ICONS[app.id]} size={22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body-lg font-semibold text-text">{app.label}</span>
        <span className="text-small text-muted">{app.line}</span>
      </span>
      {children}
    </>
  );
}

export function MoreFlyout({ onOpen }: Readonly<{ onOpen: (flyout: Flyout) => void }>) {
  return (
    <ul aria-label="Your apps" className="flex flex-col gap-2.5" data-testid="editor-more">
      {MORE_APPS.map((app) => (
        <li key={app.id}>
          {"opens" in app ? (
            <button type="button" onClick={() => onOpen(app.opens)} className={ROW} data-testid={`editor-app-${app.id}`}>
              <AppRow app={app}>{null}</AppRow>
            </button>
          ) : (
            <Link href={app.href as Route} className={ROW} data-testid={`editor-app-${app.id}`}>
              <AppRow app={app}>
                <span className="sr-only">(opens the {app.label} page)</span>
              </AppRow>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

const LESSONS: readonly Readonly<{ id: string; title: string; body: string; opens: Flyout | null; action: string | null }>[] = [
  {
    id: "mockups",
    title: "Put your kit on a mockup",
    body: "Pick a scene and the platform draws your garment into it. The garment stays exactly as you designed it.",
    opens: { kind: "panel", id: "mockups" },
    action: "Open Mockups",
  },
  {
    id: "templates",
    title: "Start from a launch template",
    body: "A template lays out the boards of a launch for you: the kit, its mockups and the posts that go with them.",
    opens: { kind: "panel", id: "templates" },
    action: "Open Templates",
  },
  {
    id: "checks",
    title: "Fix a red check",
    body: "Select a garment board and open it in the editor. Every check lists what failed and a Why? that names the rule behind it.",
    opens: null,
    action: null,
  },
  {
    id: "run-all",
    title: "Run every board at once",
    body: "Click an empty part of the canvas. The right panel then shows the run summary, with Run all and what it would cost before anything is spent.",
    opens: null,
    action: null,
  },
  { id: "keys", title: "Work from the keyboard", body: "Every shortcut the editor answers to, in one list.", opens: { kind: "own", id: "help" }, action: "Show shortcuts" },
];

export function LearnFlyout({ onOpen }: Readonly<{ onOpen: (flyout: Flyout) => void }>) {
  return (
    <ul aria-label="Lessons" className="flex flex-col gap-2.5" data-testid="editor-learn">
      {LESSONS.map((lesson) => (
        <li key={lesson.id} className="flex flex-col gap-1.5 rounded-xl bg-soft p-3">
          <h3 className="text-body font-semibold text-text">{lesson.title}</h3>
          <p className="text-small leading-relaxed text-muted">{lesson.body}</p>
          {lesson.opens && lesson.action ? (
            <button type="button" onClick={() => lesson.opens && onOpen(lesson.opens)} className="self-start text-small font-semibold text-link hover:underline">
              {lesson.action}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function HelpFlyout() {
  return (
    <div className="flex flex-col gap-4" data-testid="editor-help">
      <section aria-label="Keyboard shortcuts" className="flex flex-col gap-2">
        <h3 className="text-body font-semibold text-text">Keyboard shortcuts</h3>
        <dl className="flex flex-col">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.does} className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
              <dt className="text-small text-text-2">{row.does}</dt>
              <dd className="flex gap-1">
                {row.keys.map((key) => (
                  <kbd key={key} className="rounded-xs border border-border bg-soft px-1.5 font-sans text-caption text-text-2">
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label="Contact us" className="flex flex-col gap-1.5 rounded-xl bg-soft p-3">
        <h3 className="text-body font-semibold text-text">Still stuck?</h3>
        <p className="text-small text-muted">Write to us and a person will answer.</p>
        <a href={helpHref(PRODUCT.contactEmail)} className="self-start text-small font-semibold text-link hover:underline">
          Email {PRODUCT.contactEmail}
        </a>
      </section>
    </div>
  );
}
