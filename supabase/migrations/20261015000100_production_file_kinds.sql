-- File kinds for the production outputs (plans/production-outputs.md, workstream W0).
--
-- Print files, proof photos, team rosters and the source files of patterns are stored with the
-- other files. Print files, rosters and source patterns go in "exports"; a proof photo is a
-- picture and goes in "uploads", whose types already allow it. Only this migration touches the
-- kind list and the bucket types, so the workstreams that follow never fight over them.

alter table public.files drop constraint files_kind_check;
alter table public.files add constraint files_kind_check
  check (kind in (
    'artwork', 'sketch', 'photo', 'render', 'export', 'chart', 'pattern',
    'print', 'proof', 'roster', 'pattern-source'
  ));

-- SVG is allowed here for print files the server builds and checks for scripts before storing
-- (lib/storage/store.ts). Files are downloaded from this bucket, never shown inline.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/dxf',
  'image/tiff',
  'image/svg+xml',
  'text/csv'
]
where id = 'exports';
