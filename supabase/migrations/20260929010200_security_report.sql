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
        'client_privileges', (
          select coalesce(jsonb_agg(distinct g.privilege_type order by g.privilege_type), '[]'::jsonb)
          from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = c.relname
            and g.grantee in ('anon', 'authenticated')
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
    'functions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', f.proname,
        'security_definer', f.prosecdef,
        'fixed_search_path', exists (
          select 1 from unnest(coalesce(f.proconfig, '{}')) setting
          where setting like 'search_path=%'
        ),
        'anon', has_function_privilege('anon', f.oid, 'execute'),
        'authenticated', has_function_privilege('authenticated', f.oid, 'execute')
      ) order by f.proname), '[]'::jsonb)
      from pg_catalog.pg_proc f
      join pg_catalog.pg_namespace n on n.oid = f.pronamespace
      where n.nspname = 'public'
    )
  );
$$;

comment on function public.security_report() is
  'Lists tables, buckets and functions with their access rules. Read by the isolation tests. Server only.';

revoke all on function public.security_report() from public, anon, authenticated;
grant execute on function public.security_report() to service_role;
