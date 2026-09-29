/**
 * Thrown when the document is not fit to be written to a file. The types make these
 * documents impossible, so reaching one means a bug. It is a plain error on purpose: the
 * route logs it and answers with the general message, and no file is sent.
 */
export class ExportRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportRefused";
  }
}

/** Thrown when a view is asked for and the garment type has no drawing. This is not a bug: the person is told. */
export class NoDrawing extends Error {
  constructor() {
    super("There is no drawing for this garment type yet.");
    this.name = "NoDrawing";
  }
}
