/** Where the kit style gallery was opened from, and so where a pick goes back to. Kept apart so a browser page can link here without the drawing code. */
export const GALLERY_FROM = ["guide", "editor"] as const;
export type GalleryFrom = (typeof GALLERY_FROM)[number];

export const galleryAddress = (projectId: string, from: GalleryFrom): string => `/studio/${projectId}/kit-styles?from=${from}`;
