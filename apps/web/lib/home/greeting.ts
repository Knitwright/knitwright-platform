/**
 * The greeting at the top of the studio home (spec F-S4, "Body": "Good morning, Gloria"). The hour
 * is passed in, so the words do not depend on a clock, and the name is the workspace's, the only
 * name the home page knows.
 */

/** Morning until noon, afternoon until six, evening after that. `hour` is 0 to 23. */
export function greetingFor(hour: number, name: string): string {
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name}`;
}
