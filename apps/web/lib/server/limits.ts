import type { RateLimitRule } from "./core/guard";

/**
 * Every rate limit in one place. Each applies per address and, when the caller is
 * signed in, per user as well.
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const LIMITS = {
  signUp: { name: "sign-up", limit: 5, windowSeconds: HOUR },
  signIn: { name: "sign-in", limit: 10, windowSeconds: 10 * MINUTE },
  passwordReset: { name: "password-reset", limit: 5, windowSeconds: HOUR },
  confirmLink: { name: "confirm-link", limit: 10, windowSeconds: 10 * MINUTE },
  oauthStart: { name: "oauth-start", limit: 20, windowSeconds: 10 * MINUTE },
  oauthReturn: { name: "oauth-return", limit: 20, windowSeconds: 10 * MINUTE },
  updatePassword: { name: "update-password", limit: 5, windowSeconds: HOUR },
  signOut: { name: "sign-out", limit: 30, windowSeconds: 10 * MINUTE },
  read: { name: "read", limit: 120, windowSeconds: MINUTE },
  createBrand: { name: "create-brand", limit: 10, windowSeconds: HOUR },
  changeBrand: { name: "change-brand", limit: 30, windowSeconds: 10 * MINUTE },
  upload: { name: "upload", limit: 30, windowSeconds: 10 * MINUTE },
  fileLink: { name: "file-link", limit: 120, windowSeconds: MINUTE },
  createProject: { name: "create-project", limit: 30, windowSeconds: HOUR },
  // Every control in the editor is one save, so this is the busiest limit of the four.
  editDesign: { name: "edit-design", limit: 120, windowSeconds: MINUTE },
  restoreVersion: { name: "restore-version", limit: 60, windowSeconds: 10 * MINUTE },
  renameProject: { name: "rename-project", limit: 30, windowSeconds: 10 * MINUTE },
  // An export builds a file in memory, which costs a second or two of a small function, so it is
  // limited like an upload: 30 in ten minutes, which is seven downloads of all four files.
  export: { name: "export", limit: 30, windowSeconds: 10 * MINUTE },
  // Each message may reach a paid model. The allowances cap the spend; this caps the pace.
  assistant: { name: "assistant", limit: 20, windowSeconds: MINUTE },
  // Choosing one of the assistant's proposals.
  applyProposal: { name: "apply-proposal", limit: 60, windowSeconds: 10 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;
