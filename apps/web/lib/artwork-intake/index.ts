/**
 * The public face of artwork intake (W7b). W3 (print files) imports the asset reader and the vector model;
 * W7d (design from an image) imports the reader and `tile/` (`findRepeat`, `seamReport`). Nothing else in here
 * is for other workstreams: they never open a stored original, because none is kept.
 */
export { createAssetReader, readVectorModel } from "./reader";
export { dpiWarning, effectiveDpi, largestWidthMm } from "./dpi";
export { DEFAULT_MIN_DPI, INTAKE_LIMITS, VECTOR_LIMITS } from "./settings";
export { intakeArtwork, type Intake, type SourceFormat } from "./intake";
export { deleteArtwork, uploadArtwork, type Actor } from "./service";
export { type ArtworkRecord } from "./records";
export { vectorModelSchema, VECTOR_MODEL_VERSION, type VectorModel, type VectorNode } from "./vector/model";
export { modelToSvg } from "./vector/to-svg";
export * from "./tile";
