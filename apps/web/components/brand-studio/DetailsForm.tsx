"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL, TEXT_AREA } from "@/components/ui/field-styles";
import { saveBrandProfileAction } from "@/lib/brand-studio/actions";
import type { BrandProfile } from "@/lib/brand-studio/types";
import {
  BRAND_CATEGORIES,
  CATEGORY_LABELS,
  LIMITS,
  STYLE_FIELDS,
  STYLE_HINTS,
  STYLE_LABELS,
  VOICE_TAGS,
  VOICE_TAG_LABELS,
  type BrandCategory,
  type StyleField,
  type VoiceTag,
} from "@/lib/brand-studio/words";

type Props = Readonly<{ profile: BrandProfile; canEdit: boolean; part: "details" | "style" }>;

/**
 * Details (category, website, about, voice and tone) and the three visual-style texts of F-S9. Both
 * parts save the whole brand record, so the form holds every field and shows only the part asked
 * for. The texts are typed by hand; L7 writes them from reference images in a later wave.
 */
export function DetailsForm({ profile, canEdit, part }: Props) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const sizesId = useId();

  const save = async () => {
    setBusy(true);
    const reply = await saveBrandProfileAction({
      category: draft.category,
      website: draft.website ?? "",
      about: draft.about,
      voiceTags: draft.voiceTags,
      setting: draft.style.setting,
      artDirection: draft.style.artDirection,
      rulesBoundaries: draft.style.rulesBoundaries,
      defaultSizeRange: draft.defaultSizeRange,
    });
    setBusy(false);
    setNote(reply.success ? { tone: "ok", text: "Your brand is saved." } : { tone: "warn", text: reply.error.message });
  };

  const setStyle = (field: StyleField, value: string) => setDraft({ ...draft, style: { ...draft.style, [field]: value } });
  const toggleTag = (tag: VoiceTag) =>
    setDraft({ ...draft, voiceTags: draft.voiceTags.includes(tag) ? draft.voiceTags.filter((other) => other !== tag) : [...draft.voiceTags, tag] });

  return (
    <div className="flex flex-col gap-5">
      {part === "details" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Category</span>
            <select
              className={FIELD_CONTROL}
              disabled={!canEdit}
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as BrandCategory })}
            >
              {BRAND_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Website</span>
            <input
              className={FIELD_CONTROL}
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={LIMITS.website}
              disabled={!canEdit}
              value={draft.website ?? ""}
              onChange={(event) => setDraft({ ...draft, website: event.target.value === "" ? null : event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">About</span>
            <textarea
              className={TEXT_AREA}
              rows={5}
              maxLength={LIMITS.about}
              disabled={!canEdit}
              value={draft.about}
              onChange={(event) => setDraft({ ...draft, about: event.target.value })}
            />
            <span className="text-[13px] text-muted">{LIMITS.about - draft.about.length} characters left.</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Voice and tone</legend>
            <div className="flex flex-wrap gap-2">
              {VOICE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={draft.voiceTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                  className={`min-h-10 rounded-full border px-4 text-sm ${
                    draft.voiceTags.includes(tag) ? "border-cobalt-soft bg-white/[0.08] text-ink" : "border-hairline text-muted"
                  } disabled:cursor-not-allowed`}
                >
                  {VOICE_TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor={sizesId} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Sizes you make by default</span>
            <input
              id={sizesId}
              className={FIELD_CONTROL}
              placeholder="S, M, L, XL"
              disabled={!canEdit}
              value={draft.defaultSizeRange.join(", ")}
              onChange={(event) =>
                setDraft({ ...draft, defaultSizeRange: event.target.value.split(",").map((label) => label.trim()).filter((label) => label !== "") })
              }
            />
            <span className="text-[13px] text-muted">Separate them with commas. Empty until you say; nothing is assumed.</span>
          </label>
        </>
      ) : (
        STYLE_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{STYLE_LABELS[field]}</span>
            <span className="text-[13px] text-muted">{STYLE_HINTS[field]}</span>
            <textarea
              className={TEXT_AREA}
              rows={4}
              maxLength={LIMITS.styleText}
              disabled={!canEdit}
              value={draft.style[field]}
              onChange={(event) => setStyle(field, event.target.value)}
            />
          </label>
        ))
      )}

      {canEdit ? (
        <div>
          <Button type="button" pending={busy} onClick={() => void save()}>
            Save brand
          </Button>
        </div>
      ) : (
        <Notice>Your role can look at the brand but not change it.</Notice>
      )}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </div>
  );
}
