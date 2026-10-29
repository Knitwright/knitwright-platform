import type { Severity } from "./types";

/**
 * The offensive-word list. Curated by Knitwright for this workstream (decision 0073), not copied from a licensed list, and kept
 * short on purpose: whole words only, after normalisation. A word that is also a name or an ordinary word ("Dick" is a first
 * name) only flags it for a person to look at; slurs and strong swearing block.
 *
 * `prefix` words also match the start of a longer word ("fuckoff"), for the few stems that have no innocent continuation in
 * English team or player names.
 */
export type OffensiveWord = Readonly<{ word: string; severity: Exclude<Severity, "note">; prefix?: boolean }>;

const block = (word: string, prefix = false): OffensiveWord => (prefix ? { word, severity: "block", prefix } : { word, severity: "block" });
const flag = (word: string): OffensiveWord => ({ word, severity: "flag" });

export const OFFENSIVE_WORDS: readonly OffensiveWord[] = [
  // Slurs: always blocked.
  block("nigger", true),
  block("nigga", true),
  block("faggot", true),
  block("fag"),
  block("retard", true),
  block("spastic"),
  block("paki"),
  block("chink"),
  block("kike"),
  block("tranny"),
  // Strong swearing: blocked.
  block("fuck", true),
  block("motherfucker"),
  block("cunt", true),
  block("shit"),
  block("shite"),
  block("bullshit"),
  block("wanker"),
  block("twat"),
  block("whore"),
  block("slut"),
  block("bitch"),
  block("asshole"),
  block("arsehole"),
  // Words that are also names or ordinary words: a person decides.
  flag("dick"),
  flag("cock"),
  flag("prick"),
  flag("bastard"),
  flag("bollocks"),
  flag("piss"),
  flag("tits"),
  flag("nazi"),
];
