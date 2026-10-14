/** One way for the production panels to talk to their routes. Every answer is the app's usual envelope. */

export type Reply<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; message: string; fields: Readonly<Record<string, readonly string[]>> }>;

const SAID_NOTHING = "Something went wrong. Try again.";

export async function call<T>(url: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: unknown): Promise<Reply<T>> {
  try {
    const response = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    const envelope = (await response.json()) as
      | { success: true; data: T }
      | { success: false; error: { message: string; fields?: Record<string, readonly string[]> } };
    if (envelope.success) return { ok: true, data: envelope.data };
    return { ok: false, message: envelope.error.message, fields: envelope.error.fields ?? {} };
  } catch {
    return { ok: false, message: SAID_NOTHING, fields: {} };
  }
}

export const projectUrl = (projectId: string, path: string): string => `/api/projects/${projectId}/${path}`;
