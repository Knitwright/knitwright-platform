-- What the isolation suite reads to find every table, bucket and function, so that a
-- new one cannot be added without the suite noticing. Plan step 3, task 7.

create function public.security_report()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'rls_enabled', c.relrowsecurity,
        'policies', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'name', p.polname,
            'command', case p.polcmd
              when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
              when 'd' then 'delete' else 'all' end
          ) order by p.polname), '[]'::jsonb)
          from pg_catalog.pg_policy p where p.polrelid = c.oid
        ),
        -- Asks what each role can in fact do, so a right given on one column, or
        -- reached through another role, is counted too.
        'client_privileges', (
          select coalesce(jsonb_agg(distinct p.privilege order by p.privilege), '[]'::jsonb)
          from unnest(array['anon', 'authenticated']) as r(role_name)
          cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'])
            as p(privilege)
          where has_table_privilege(r.role_name, c.oid, p.privilege)
             or (p.privilege <> 'DELETE' and p.privilege <> 'TRUNCATE'
                 and has_any_column_privilege(r.role_name, c.oid, p.privilege))
        )
      ) order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    ),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'public', b.public
      ) order by b.id), '[]'::jsonb)
      from storage.buckets b
    ),
    'storage_policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.polname,
        'command', case p.polcmd
          when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
          when 'd' then 'delete' else 'all' end
      ) order by p.polname), '[]'::jsonb)
      from pg_catalog.pg_policy p
      where p.polrelid = 'storage.objects'::regclass
    ),
    'storage_tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.relname, 'rls_enabled', c.relrowsecurity
      ) order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'storage' and c.relkind in ('r', 'p')
    ),
    -- Each function is named with its arguments, so two with one name are two entries.
    'functions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'signature', n.nspname || '.' || f.proname || '('
          || pg_get_function_identity_arguments(f.oid) || ')',
        'security_definer', f.prosecdef,
        'fixed_search_path', exists (
          select 1 from unnest(coalesce(f.proconfig, '{}')) setting
          where setting like 'search_path=%'
        ),
        'anon', has_function_privilege('anon', f.oid, 'execute'),
        'authenticated', has_function_privilege('authenticated', f.oid, 'execute')
      ) order by n.nspname, f.proname, f.oid), '[]'::jsonb)
      from pg_catalog.pg_proc f
      join pg_catalog.pg_namespace n on n.oid = f.pronamespace
      where n.nspname in ('public', 'private')
    )
  );
$$;

comment on function public.security_report() is
  'Lists tables, buckets and functions with their access rules. Read by the isolation tests. Server only.';

revoke all on function public.security_report() from public, anon, authenticated;
grant execute on function public.security_report() to service_role;
