// Scratch: seeds a member with 14 designs and writes a cookie header for timing. Not committed.
import { writeFileSync } from "node:fs";
import { createAdminClient, createSessionClient } from "@/lib/supabase/clients";
import { createProject } from "@/lib/projects/service";
import { brandChartSet } from "@/lib/charts/service";

const settings = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL!,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
};
const PASSWORD = "correct-horse-battery";
const TYPES = ["crew-tee", "polo", "team-jersey", "pullover-hoodie", "shorts", "track-jacket", "v-neck-tee"];

async function main() {
  const admin = createAdminClient(settings);
  const email = `perf-${Date.now()}@e2e.knitwright.local`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  await admin.auth.admin.updateUserById(userId, { password: PASSWORD, app_metadata: { password_set: true } });
  const brand = await admin.from("brands").insert({ name: "Perf brand", created_by: userId }).select("id").single();
  if (brand.error) throw brand.error;
  await admin.from("memberships").insert({ brand_id: brand.data.id, user_id: userId, role: "owner" });
  const charts = await brandChartSet(admin, brand.data.id);
  const ids: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    ids.push(
      await createProject(admin, {
        brandId: brand.data.id,
        userId,
        name: `Perf design ${i + 1}`,
        styleNumber: `P-${i}`,
        season: "SS27",
        typeId: TYPES[i % TYPES.length]!,
        wearer: "men",
        charts,
      }),
    );
  }
  const jar = new Map<string, string>();
  const client = createSessionClient(settings, {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (toSet) => toSet.forEach((c) => jar.set(c.name, c.value)),
  });
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD, options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
  if (signed.error) throw signed.error;
  await new Promise((r) => setTimeout(r, 200));
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  writeFileSync(process.argv[2]!, JSON.stringify({ cookie, projectId: ids[ids.length - 1], email }));
  console.log("seeded", email, ids.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
