-- The mockup scenes of docs/spec/07-template-library.md as rows of public.templates
-- (plans/platform-v5.md wave 4, workstream L2; spec F-L1; decision 0092).
--
-- No migration was assigned to L2. This one takes the wave's own date and the next free hour, as the
-- plan says to, and the pull request says so.
--
-- `07` names seven kinds of template and L8 added `templates.kind` for them
-- (20261201050000_template_kinds.sql). A mockup scene is one of those kinds, and it is seeded as a
-- `templates` row with the scene itself in `snapshot`: no column is added here, so nothing runs into
-- the trap that a column added later carries no grant and a read naming it is refused for the whole
-- table. `snapshot` is already granted to `authenticated` (20261030020000_member_visible_columns.sql).
--
-- ONE THING HAS TO CHANGE, AND IT IS WHY THIS FILE EXISTS.
--
-- `templates` was written for finished designs, so it requires `article_id` (a garment type) and
-- `wearer` (men, women or youth) on every row. **A mockup scene has neither.** `07` gives a scene
-- garment *slots*, not an article: the article is whatever design feeds the board, and a scene like
-- "Folded stack" or "E-commerce white" is for any garment the platform can draw. Writing a garment
-- type a scene is not for would be stating a fact nobody can support, which the plan's own rules
-- forbid. So both columns become nullable and a constraint keeps them required for the kind that
-- really has them -- a design.
--
-- No measurement, no money, no Store concept and no person is anywhere in this file. The scene rows
-- themselves are written by the server's key through lib/mockups/seed.ts, as every other template is.

alter table public.templates
  alter column article_id drop not null,
  alter column wearer drop not null;

-- A design still names the garment it is drawn on and who it is cut for. Only the kinds that have no
-- article may leave them empty, and `kind` defaults to 'design', so an insert that forgets both is
-- refused exactly as it was before this migration.
alter table public.templates
  add constraint templates_design_names_an_article check (
    kind <> 'design' or (article_id is not null and wearer is not null)
  );

comment on column public.templates.article_id is
  'The garment article a design template is drawn on. Null only for a kind that is not drawn on one article: a mockup scene has garment slots instead (docs/spec/07-template-library.md).';
comment on column public.templates.wearer is
  'Who a design template is cut for. Null only for a kind that is not a design.';

-- Reading scenes by kind is what every reader of this table now does, so the index carries it.
create index templates_mockup_scene_idx on public.templates (kind, slug) where kind = 'mockup_scene';
