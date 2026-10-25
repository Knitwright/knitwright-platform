-- Turntable and clip files (plan v4, workstream W3-D, decision record 0058).
--
-- A turntable is recorded in the browser (WebM, or MP4 where the browser records that) and a clip is made by a video
-- model. Both are kept in the images bucket under "_private/<brand id>/<set id>/..." exactly like a clean studio
-- render: no member policy reaches that folder, so only the server's own key reads a video, and it hands out a clip
-- only once the set is unlocked. The bucket allowed PNG and JPEG at 10 MiB; it now also allows the two video types, at
-- 30 MiB. Everything that writes to the bucket checks its own file first (lib/storage and lib/media/video), so the
-- larger limit does not let a browser store anything: browsers have no write right to storage.
update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array(select distinct kind from unnest(allowed_mime_types || array['video/webm', 'video/mp4']) as kind order by kind)
where id = 'images';
