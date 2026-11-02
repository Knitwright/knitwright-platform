import { QUOTE_SETTINGS } from "./settings";

/**
 * The quote number (spec F-T5, "quote number").
 *
 * It is DERIVED, not counted. Nothing stores a quote yet — there is no quotes table and this
 * workstream adds none — so a counted sequence would need a row and would give a different number
 * every time a club pressed the button twice. Instead the number is a function of the day and of
 * what is being quoted, so the same basket on the same day always gives the same number, which is
 * what a club comparing two printouts needs. **Owner question** on the pull request: should a quote
 * be stored and numbered in a sequence, so Knitwright can look one up when a club quotes it back?
 */

/** The date part, in the club's own reading order: `20261102`. */
export const dayPart = (at: Date): string =>
  [at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("");

/** Letters and digits that cannot be read as each other: no I, no O, no 0, no 1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A short reference for what is being quoted. The same text always gives the same reference, and a
 * one-character change gives a different one. It is not a secret and nothing is derived back from it.
 */
export function referenceFor(text: string, length: number = QUOTE_SETTINGS.referenceLength): string {
  let hash = 0x811c_9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  let second = 0x7fff_ffff ^ hash;
  const out: string[] = [];
  for (let at = 0; at < length; at += 1) {
    out.push(ALPHABET[hash % ALPHABET.length]!);
    hash = Math.floor(hash / ALPHABET.length) + Math.imul(second, 0x27d4_eb2f);
    hash >>>= 0;
    second = (second * 1_664_525 + 1_013_904_223) >>> 0;
  }
  return out.join("");
}

/** What a quote is about, in the words the number is derived from. Order never changes the answer. */
export interface QuoteSubject {
  readonly clubName: string;
  readonly sportId: string;
  readonly currency: string;
  readonly lines: readonly Readonly<{ articleCode: string; qty: number }>[];
}

const subjectText = (subject: QuoteSubject): string =>
  [
    subject.clubName.trim().toLowerCase(),
    subject.sportId,
    subject.currency,
    ...[...subject.lines].sort((a, b) => a.articleCode.localeCompare(b.articleCode)).map((line) => `${line.articleCode}x${line.qty}`),
  ].join("|");

/** The number a club reads: `KWQ-20261102-H7KQ4M`. */
export const quoteNumber = (at: Date, subject: QuoteSubject): string =>
  `${QUOTE_SETTINGS.numberPrefix}-${dayPart(at)}-${referenceFor(subjectText(subject))}`;

/** The day a quote stops being good for, counted in whole days from the day it was made. */
export function validUntil(at: Date, days: number = QUOTE_SETTINGS.validityDays): string {
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + days));
  return end.toISOString().slice(0, 10);
}
