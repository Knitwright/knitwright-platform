-- The Class B 50-to-300 range becomes a flag, not a refusal (orchestrator decision, plan v5 wave 2).
--
-- Workstream Y7 shipped the range as a hard refusal, in `lib/make/run.ts` and in this function. The
-- orchestrator settled it the other way, for the reason decisions 12 and 18 give: the platform must
-- not assert something no factory has confirmed. Refusing a 400-piece run says a factory will not cut
-- 400 of a style. None has said so. The brand-run builder of decision 0062 already treats a quantity
-- outside what is agreed as a flag the person must read, and this now matches it.
--
-- What does NOT change: the golden sample is still required for a run, a sample is still at most three
-- sizes, and the Class B human-review gate of moderation (F-G2, workstream Z8) is a real block. A flag
-- here is a note on the order, not permission to skip any of those.

create or replace function public.submit_make_order(
  p_brand_id uuid, p_user_id uuid, p_product_id uuid, p_kind text, p_release_id uuid,
  p_factory_profile_id text, p_fabric_key text, p_sizes jsonb, p_flags jsonb, p_request_key text
)
returns table (run_id uuid, order_id uuid, status text, cutoff_at timestamptz, promised_on date, created boolean, golden_sample_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.brand_products;
  v_version integer;
  v_class text;
  v_pieces integer;
  v_golden uuid;
  v_flags jsonb;
  v_sent record;
begin
  -- Added to, never replaced: submit_brand_run checks the shape of p_flags itself and refuses anything
  -- that is not an array, so a bad argument still fails there rather than silently here.
  v_flags := p_flags;
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not order for this brand.' using errcode = '42501';
  end if;
  if p_kind not in ('sample', 'run') then
    raise exception 'An order is a sample or a run.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'object' then
    raise exception 'Sizes must be an object of size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  if (select count(*) from jsonb_object_keys(p_sizes)) = 0 then
    raise exception 'Sizes must be an object of size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  select * into v_product from public.brand_products x where x.id = p_product_id and x.brand_id = p_brand_id;
  if not found then
    raise exception 'That product does not exist.' using errcode = 'P0002';
  end if;

  if p_kind = 'sample' and (select count(*) from jsonb_object_keys(p_sizes)) > 3 then
    raise exception 'A sample is at most 3 sizes, one piece of each.' using errcode = 'P0001', hint = 'sample_sizes';
  end if;

  if p_kind = 'run' then
    select (rel.snapshot ->> 'specVersion')::integer into v_version
    from public.production_releases rel
    where rel.id = p_release_id and rel.brand_id = p_brand_id and rel.project_id = v_product.project_id;
    if v_version is null then
      raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
    end if;
    v_golden := private.golden_sample_for_version(p_brand_id, p_product_id, v_version);
    if v_golden is null then
      raise exception 'A run needs a golden sample signed off for version %, or for a parent version that differs only on the surface.', v_version
        using errcode = 'P0001', hint = 'golden_sample_required';
    end if;

    select a.production_class into v_class
    from public.projects p
    join public.base_articles a on a.registry_type_id = p.garment_type
    where p.id = v_product.project_id and p.brand_id = p_brand_id;
    if v_class = 'B' then
      select coalesce(sum((e.value #>> '{}')::integer), 0) into v_pieces
      from jsonb_each(p_sizes) as e
      where jsonb_typeof(e.value) = 'number' and (e.value #>> '{}') ~ '^[0-9]+$';
      if v_pieces < 50 or v_pieces > 300 then
        -- Noted, not refused. A refusal would assert that the factory will not make this run, and no
        -- factory has confirmed that it will not; 50 to 300 is Knitwright's own draft programme range.
        -- The brand run contract already treats a quantity outside what is agreed this way (decision
        -- 0062, rule 5), and the screen makes the person read the flag before the order goes.
        v_flags := v_flags || jsonb_build_array(jsonb_build_object(
          'code', 'class_b_quantity',
          'text', format('A Class B run is 50 to 300 pieces per style. This one is %s pieces. Knitwright draft range, not a quantity a factory has refused.', v_pieces)
        ));
      end if;
    end if;
  end if;

  select * into v_sent from public.submit_brand_run(
    p_brand_id, p_user_id, p_product_id, p_kind, p_release_id,
    p_factory_profile_id, p_fabric_key, p_sizes, v_flags, p_request_key
  ) s;
  return query select v_sent.run_id, v_sent.order_id, v_sent.status, v_sent.cutoff_at, v_sent.promised_on, v_sent.created, v_golden;
end;
$$;

revoke all on function public.submit_make_order(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_make_order(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) to service_role;
