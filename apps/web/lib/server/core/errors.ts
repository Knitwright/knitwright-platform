/** Every way a request can fail, with the HTTP status a route answers with. */
export const FAILURE_STATUS = {
  invalid_input: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
} as const;

export type FailureCode = keyof typeof FAILURE_STATUS;

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export type Failure = Readonly<{
  code: FailureCode;
  message: string;
  fields?: FieldErrors;
}>;

/** One envelope for every route and action answer. */
export type Result<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; error: Failure }>;

/**
 * A failure the user should be told about in these words. Anything else thrown by a
 * handler is treated as unexpected: it is logged and the user sees a generic message.
 */
export class AppError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const MESSAGES = {
  unauthenticated: "Sign in to continue.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  invalid_input: "Some fields need another look.",
  too_large: "That request is too large.",
  internal: "Something went wrong on our side. Try again.",
} as const satisfies Partial<Record<FailureCode, string>>;

export const toFailure = (error: AppError): Failure =>
  error.fields
    ? { code: error.code, message: error.message, fields: error.fields }
    : { code: error.code, message: error.message };
