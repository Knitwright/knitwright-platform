export { validateDesign, type ValidationResult } from "./validate";
export { createCheckRegistry, type CheckModule, type CheckRegistry, type DesignInput } from "./registry";
export { defaultFactoryProfile, factoryProfileSchema, DEFAULT_PROFILE_LABEL, type FactoryProfile } from "./profile";
export { DRAFT, canMove, statusSentence, transition, type StatusRecord, type Transition } from "./status";
export { findingsHash, sortFindings } from "./hash";
