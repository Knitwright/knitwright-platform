/**
 * Puts the whole template library in the database named by the environment: the starter templates, the kit
 * bundles, the tech pack templates and the marketing templates (decision 0136). Run it from the repository root
 * after `pnpm db:start` and after every `supabase db reset`, which empties the library, and on the hosted project
 * after every `supabase db push`:
 *
 *   pnpm --filter web seed:templates
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment, or from apps/web/.env.local
 * when that file exists. Running it again changes the rows it made and adds nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { describeLibrarySeed, seedLibrary } from "./library";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
process.stdout.write(`${describeLibrarySeed(await seedLibrary(admin))}\n`);
