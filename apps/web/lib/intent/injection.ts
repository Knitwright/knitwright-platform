/**
 * A plain check for text that tries to change how the assistant works rather than the
 * garment. Such text is answered with a rejection before any model sees it (plan step 12
 * acceptance). This is one layer: the model is also told the words are data, and whatever
 * it answers still goes through the parser and the ambiguity rules.
 */

export const OVERRIDE_REASON =
  "That message tries to change how the assistant works, so it was not used. Describe the change you want to the garment. Nothing was changed.";

const PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(instructions?|rules|prompts?|above|previous|prior|system|guidelines)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+now\b/i,
  /\bpretend\s+(to\s+be|you)\b/i,
  /\bact\s+as\s+(a|an|if)\b/i,
  /\b(developer|god|admin)\s+mode\b/i,
  /\bjailbreak/i,
  /\b(reveal|show|print|repeat)\b[^.!?\n]{0,30}\b(prompt|instructions)\b/i,
  /\bnew\s+(rules|instructions)\b/i,
  /<\/?\s*(system|assistant|user|instructions?)\s*>/i,
  /(^|\n)\s*(system|assistant|developer)\s*:/i,
  /"kind"\s*:/i,
];

export function looksLikeOverride(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text));
}
