/** Runs once when the server starts. An invalid environment stops it here. */
export async function register() {
  const { getEnv } = await import("@/lib/config/env");
  getEnv();
}
