import type { Tone } from "@/lib/projects/provenance-tone";

/**
 * Says where a value came from, in words. A person's value is plain ink. A suggestion
 * uses the warn colours. Nothing here uses the green of a value signed by a named person:
 * that record does not exist yet.
 */
const TONES: Readonly<Record<Tone, string>> = {
  person: "text-ink",
  suggested: "rounded-md bg-warn-wash px-2 py-0.5 text-warn",
  derived: "text-muted",
};

type ProvenanceBadgeProps = Readonly<{ label: string; tone: Tone }>;

export function ProvenanceBadge({ label, tone }: ProvenanceBadgeProps) {
  return (
    <span className={`inline-block text-sm ${TONES[tone]}`} data-tone={tone}>
      {label}
    </span>
  );
}
