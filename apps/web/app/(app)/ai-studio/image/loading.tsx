import { WorkflowSkeleton } from "@/components/ai-studio/StudioSkeleton";

/** The Image generator in outline while your designs load (10 §9). */
export default function ImageGeneratorLoading() {
  return <WorkflowSkeleton label="Loading the image generator" />;
}
