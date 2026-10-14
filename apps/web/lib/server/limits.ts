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
  // Reading a sketch or photo is the dearest assistant call.
  readImage: { name: "read-image", limit: 10, windowSeconds: 10 * MINUTE },
  // Photoreal images cost money; the allowance caps the spend, this caps the attempts.
  startImages: { name: "start-images", limit: 10, windowSeconds: HOUR },
  // The browser asks every 2 seconds while images are being made.
  pollJob: { name: "poll-job", limit: 90, windowSeconds: MINUTE },
  // A pattern is drafted outside the app and can take minutes; a few an hour is plenty.
  startPattern: { name: "start-pattern", limit: 20, windowSeconds: HOUR },
  // Uploading a chart file and importing it are counted together.
  importChart: { name: "import-chart", limit: 30, windowSeconds: 10 * MINUTE },
  // Deleting cannot be undone and removes stored files, so a slip or a script can do little harm.
  deleteDesign: { name: "delete-design", limit: 20, windowSeconds: 10 * MINUTE },
  deleteAccount: { name: "delete-account", limit: 3, windowSeconds: HOUR },
  // The name shown as "Made by" in tech packs. Kept in the person's sign-in profile.
  changeProfile: { name: "change-profile", limit: 20, windowSeconds: 10 * MINUTE },
  // A quote request reaches a person at Knitwright, so a few an hour is plenty (decision 0024).
  requestQuote: { name: "request-quote", limit: 10, windowSeconds: HOUR },
  // Asking for access while sign-up is by invitation. No account is needed, so the bot check guards it too.
  requestAccess: { name: "request-access", limit: 5, windowSeconds: HOUR },
  // Platform admins working through the leads page.
  manageLeads: { name: "manage-leads", limit: 120, windowSeconds: 10 * MINUTE },
  // The marketing email box in Settings.
  changeConsent: { name: "change-consent", limit: 20, windowSeconds: 10 * MINUTE },
  // An unsubscribe link needs no sign-in. A person clicks it once; this stops a script hammering it.
  unsubscribe: { name: "unsubscribe", limit: 20, windowSeconds: 10 * MINUTE },
  // Share links (decision 0026). Making one, and revoking or moving one, by a member.
  createShareLink: { name: "create-share-link", limit: 20, windowSeconds: HOUR },
  changeShareLink: { name: "change-share-link", limit: 60, windowSeconds: 10 * MINUTE },
  // Opening a share page draws the design on the server, with no session, so each address is held
  // to a page a second on average.
  shareView: { name: "share-view", limit: 60, windowSeconds: MINUTE },
  // A visitor's vote or comment, per address. The bot check guards it as well.
  shareRespond: { name: "share-respond", limit: 10, windowSeconds: 10 * MINUTE },
  // The same answers per link, whatever the address, so many addresses cannot flood one design.
  // Counted in lib/share/respond.ts, inside the action.
  shareRespondLink: { name: "share-respond-link", limit: 60, windowSeconds: 10 * MINUTE },
  // Production outputs (plans/production-outputs.md). Pattern uploads and measuring read and parse files.
  patternLibrary: { name: "pattern-library", limit: 30, windowSeconds: 10 * MINUTE },
  fabricWrite: { name: "fabric-write", limit: 60, windowSeconds: 10 * MINUTE },
  // A print file set is drawn and rasterised on the server, like an export but larger.
  printFiles: { name: "print-files", limit: 20, windowSeconds: 10 * MINUTE },
  rosterImport: { name: "roster-import", limit: 20, windowSeconds: 10 * MINUTE },
  // A release freezes a design for good, so a slip or a script can do little harm.
  releaseCreate: { name: "release-create", limit: 20, windowSeconds: HOUR },
  proofWrite: { name: "proof-write", limit: 60, windowSeconds: 10 * MINUTE },
  // Reading a design from a picture reaches a vision model and sometimes an image model (W7d). A daily cap per
  // person and address; the per-brand daily cap is counted in lib/design-import/service.ts. Proposed low (owner item P16).
  designImport: { name: "design-import", limit: 10, windowSeconds: 24 * HOUR },
} as const satisfies Record<string, RateLimitRule>;
