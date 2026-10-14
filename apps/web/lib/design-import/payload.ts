import type { ImportRecord } from "./store";

/** What a browser is given of a reading. The picture itself is fetched through the files route. */
export function payloadOf(record: ImportRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    sourceFileId: record.sourceFileId,
    status: record.status,
    report: record.report,
    stack: record.stack,
    landmarks: record.stored,
    error: record.error,
    acceptedAt: record.acceptedAt,
    acceptedLayers: record.acceptedLayers,
  };
}

export type ReadingPayload = ReturnType<typeof payloadOf>;
