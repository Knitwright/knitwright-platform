-- The conversation with the assistant about each design.
--
-- A person who leaves a design and comes back sees what they asked and what the assistant
-- answered, in order. Each line is one bubble: the person's words, or the assistant's answer
-- with its list of what changed or what was offered. Signed proposals are never stored here;
-- an old answer is shown, not tapped again.
--
-- It follows the other brand tables. Members read their brand's conversations. Only the server
-- writes, through its own key: there is no write grant and no write policy for any browser
-- role. A line is never changed or removed, except with the design it belongs to. There is no
-- column for the person who wrote it, so it is brand data that never stops anyone's account
-- from being deleted.

create table public.assistant_messages (
  -- Lines written together keep their order, so the order is the identity's, not the clock's.
  id bigint generated always as identity primary key,
  brand_id uuid not null,
  project_id uuid not null,
  role text not null check (role in ('person', 'assistant')),
  kind text not null check (kind in ('text', 'applied', 'question', 'rejection', 'failed')),
  body text not null check (length(body) between 1 and 2000),
  -- What changed, or what was offered. The server keeps each line to the length of a bubble.
  lines text[] not null default '{}' check (cardinality(lines) <= 40),
  created_at timestamptz not null default now(),
  -- The person only ever says words; every other kind is the assistant's.
  constraint assistant_messages_role_kind check ((role = 'person') = (kind = 'text')),
  -- The design and its brand together, so the two cannot disagree.
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.assistant_messages is
  'The conversation with the assistant about each design. Append-only: see private.refuse_assistant_message_change. Written by the server only.';

create index assistant_messages_project_idx on public.assistant_messages (brand_id, project_id, id desc);

revoke all on public.assistant_messages from public, anon, authenticated, service_role;
grant select on public.assistant_messages to authenticated;
grant select, insert on public.assistant_messages to service_role;

alter table public.assistant_messages enable row level security;

create policy "members read their brand's conversations"
  on public.assistant_messages for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- A second lock, as on the history of a design and the record of downloads. The grants already
-- stop every role from changing or removing a line; this stops the owner of the table and any
-- role given a grant by mistake. It lets through only the delete that follows from deleting the
-- design: by then the design is gone, so the line has nothing left to belong to.
create function private.refuse_assistant_message_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.projects p where p.id = old.project_id) then
    return old;
  end if;
  raise exception 'A line of a conversation can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_assistant_message_change() from public, anon, authenticated;

create trigger assistant_messages_are_append_only
  before update or delete on public.assistant_messages
  for each row execute function private.refuse_assistant_message_change();

create trigger assistant_messages_are_not_truncated
  before truncate on public.assistant_messages
  for each statement execute function private.refuse_assistant_message_change();
