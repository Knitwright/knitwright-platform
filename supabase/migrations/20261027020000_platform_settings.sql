-- Platform settings console (plan v4, workstream W3-F, decision 0056).
--
-- Every placeholder the owner answers in docs/owner/questionnaire-2026-10-25.md becomes a setting a
-- platform admin can change without a deploy. platform_settings holds the value now in force, one row
-- per key; platform_settings_history keeps every change, append-only, with who made it and when.
--
-- Nobody in a browser reads or writes either table: the server reads them with its own key and
-- writes them only through platform_setting_set, which refuses anyone who is not a platform admin.
-- The app checks each key against a schema before it calls the function (lib/settings/registry.ts);
-- the database checks the shape of the key and that the value is JSON. NO SECRET IS EVER STORED HERE.
-- Nothing refers to another workstream's tables, so migrations merge in any order.

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(key) <= 100),
  value jsonb not null,
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

comment on table public.platform_settings is
  'The value now in force for each platform setting. Platform admins only, through platform_setting_set. No secrets.';

create table public.platform_settings_history (
  id uuid primary key default gen_random_uuid(),
  -- The order changes were made in, for a stable history when two share a moment.
  seq bigint generated always as identity,
  key text not null check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(key) <= 100),
  -- The value set, or null when the setting was reset to the Knitwright default.
  value jsonb,
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

comment on table public.platform_settings_history is
  'Every change to a platform setting. Append-only; written by platform_setting_set only.';

create index platform_settings_history_key_idx on public.platform_settings_history (key, seq desc);

create function private.refuse_settings_history_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'A settings history line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_settings_history_change() from public, anon, authenticated;

create trigger platform_settings_history_is_append_only
  before update or delete on public.platform_settings_history
  for each row execute function private.refuse_settings_history_change();

create trigger platform_settings_history_is_not_truncated
  before truncate on public.platform_settings_history
  for each statement execute function private.refuse_settings_history_change();

revoke all on public.platform_settings, public.platform_settings_history
  from public, anon, authenticated, service_role;
grant select on public.platform_settings, public.platform_settings_history to service_role;

alter table public.platform_settings enable row level security;
alter table public.platform_settings_history enable row level security;

-- There are no policies for browsers, on purpose: the server's key reads and the function writes.

-- Sets a setting (p_value) or puts it back to the Knitwright default (p_value null), and records it.
create function public.platform_setting_set(p_actor uuid, p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if p_value is null then
    delete from public.platform_settings where key = p_key;
  else
    insert into public.platform_settings (key, value, set_by, set_at)
    values (p_key, p_value, p_actor, now())
    on conflict (key) do update
      set value = excluded.value, set_by = excluded.set_by, set_at = excluded.set_at;
  end if;
  insert into public.platform_settings_history (key, value, set_by) values (p_key, p_value, p_actor);
end;
$$;

revoke all on function public.platform_setting_set(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.platform_setting_set(uuid, text, jsonb) to service_role;
