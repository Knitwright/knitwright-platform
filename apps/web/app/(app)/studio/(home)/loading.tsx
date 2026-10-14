import { HomeSkeleton } from "@/components/home/HomeSkeleton";

/** Shown at once while the studio home is read, so a click on "Your designs" answers straight away. */
export default function StudioHomeLoading() {
  return <HomeSkeleton />;
}
