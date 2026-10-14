import { FileSkeleton } from "@/components/techpack/FileSkeleton";

/** Shown at once while the factory file is read, so opening it answers straight away. */
export default function FactoryFileLoading() {
  return <FileSkeleton />;
}
