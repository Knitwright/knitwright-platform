import type { BaseArticle } from "@/lib/catalogue";
import type { CanvasView, EditorDraft, EditorModel, FormValues, RailSegment } from "@/lib/editor";
import type { EditorData } from "@/lib/projects/editor-data";
import type { ValidationCheck } from "@/lib/validation/check";
import type { AssistantInfo } from "../Editor";
import type { WorkspaceSlots } from "../workspace/PanelSections";

/**
 * What the design editor of spec F-S4 is given on the server (decision 0075). Garment Studio (plan v6
 * G1, decision 0150) is that editor laid out again, so it takes the same props and adds its own.
 */
export type EditorShellProps = Readonly<{
  data: EditorData;
  assistant: AssistantInfo;
  /** The older 3D trial under the drawing, still behind the server switch SHOW_3D (decision 0027). */
  show3d: boolean;
  article: BaseArticle | null;
  segment: RailSegment;
  view: CanvasView;
  beside: CanvasView | null;
  size: string;
  sizes: readonly string[];
  form: FormValues;
  draft: EditorDraft | null;
  model: EditorModel | null;
  /** What the last save's checks found (X4). Empty for a version nothing has checked. */
  checks: readonly ValidationCheck[];
  slots: WorkspaceSlots;
}>;
