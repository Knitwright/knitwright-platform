-- A second guard on the size of a stored design. The app already limits how many fabrics,
-- colourways, artwork entries and measurements a design may hold, so a real design is far
-- below this. The check stops anything that gets past those limits from filling the
-- database. The size is that of the design written out as text.

alter table public.spec_versions
  add constraint spec_versions_spec_size
  check (octet_length(spec::text) <= 262144);
