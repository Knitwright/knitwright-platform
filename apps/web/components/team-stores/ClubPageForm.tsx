"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextInput } from "@/components/ui/Inputs";
import { Notice } from "@/components/ui/Notice";
import { saveClubPageAction } from "@/lib/team-stores/actions";

type Page = Readonly<{ slug: string; contact: string; published: boolean; address: string }> | null;

/**
 * THE CLUB PAGE'S SETTINGS (spec F-T6 "Club page: `<club>.knitwright.com` shows the crest, colours, current kit,
 * open stores, size guide and contact"; decision 0153). The crest and colours come from the club's kit; this sets
 * the address, the contact line and whether the page is public.
 */
export function ClubPageForm({ page, suggested, rootDomain }: Readonly<{ page: Page; suggested: string; rootDomain: string | null }>) {
  const ids = { slug: useId(), slugHint: useId(), contact: useId() };
  const [slug, setSlug] = useState(page?.slug ?? suggested);
  const [contact, setContact] = useState(page?.contact ?? "");
  const [published, setPublished] = useState(page?.published ?? false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);

  const save = async () => {
    setPending(true);
    const reply = await saveClubPageAction({ slug, contact, published }).catch(() => null);
    setPending(false);
    if (reply === null) return setNote({ tone: "warn", text: "It could not be saved. Check your connection and try again." });
    if (!reply.success) return setNote({ tone: "warn", text: reply.error.fields?.slug?.[0] ?? reply.error.message });
    setNote({ tone: "ok", text: published ? `Saved. The page is at ${reply.data.address}` : "Saved. The page is not public yet." });
  };

  return (
    <form
      className="flex max-w-xl flex-col gap-3"
      aria-label="Club page"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={ids.slug} className="flex flex-col gap-1 text-small text-text">
        Address
        <TextInput id={ids.slug} value={slug} maxLength={40} required aria-describedby={ids.slugHint} onChange={(event) => setSlug(event.target.value.toLowerCase())} />
      </label>
      <p id={ids.slugHint} className="text-caption text-muted">
        {rootDomain ? `${slug || "your-club"}.${rootDomain}` : `/clubs/${slug || "your-club"}`} · 3 to 40 lower case letters, digits and hyphens.
      </p>
      <label htmlFor={ids.contact} className="flex flex-col gap-1 text-small text-text">
        Contact
        <TextInput id={ids.contact} value={contact} maxLength={300} placeholder="kit@yourclub.org or the clubhouse number" onChange={(event) => setContact(event.target.value)} />
      </label>
      <Checkbox label="Show the page to everyone" checked={published} onChange={(event) => setPublished(event.target.checked)} />
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
      <Button type="submit" pending={pending} className="self-start">
        Save club page
      </Button>
    </form>
  );
}
