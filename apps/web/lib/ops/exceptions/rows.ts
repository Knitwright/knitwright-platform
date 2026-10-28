import { z } from "zod";
import { EXCEPTION_KINDS, type ExceptionKind } from "./rules";

const exceptionRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  kind: z.enum(EXCEPTION_KINDS),
  status: z.enum(["open", "resolved"]),
  owner: z.string(),
  due_on: z.string(),
  detail: z.record(z.string(), z.unknown()),
  note: z.string(),
  resolution: z.string().nullable(),
  resolved_on: z.string().nullable(),
  created_at: z.string(),
});

export interface OpsException {
  readonly id: string;
  readonly orderId: string;
  readonly kind: ExceptionKind;
  readonly status: "open" | "resolved";
  readonly owner: string;
  readonly dueOn: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly note: string;
  readonly resolution: string | null;
  readonly resolvedOn: string | null;
  readonly createdAt: string;
}

export const toException = (data: unknown): OpsException => {
  const r = exceptionRow.parse(data);
  return {
    id: r.id, orderId: r.order_id, kind: r.kind, status: r.status, owner: r.owner, dueOn: r.due_on, detail: r.detail, note: r.note,
    resolution: r.resolution, resolvedOn: r.resolved_on, createdAt: new Date(r.created_at).toISOString(),
  };
};

export const EXCEPTION_COLUMNS = "id, order_id, kind, status, owner, due_on, detail, note, resolution, resolved_on, created_at";
