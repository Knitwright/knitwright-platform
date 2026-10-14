import { requireMember } from "@/lib/server/page-guards";

/**
 * Each studio page rises into place when it opens. The framework draws this afresh per page,
 * so it checks the session itself, like every page and layout in the studio.
 */
export default async function StudioTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireMember();
  return <div className="rise">{children}</div>;
}
