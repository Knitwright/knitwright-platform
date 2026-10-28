/**
 * Share a picture of an unlocked set as a file, with the browser's own share sheet where it has one. The address of a
 * picture is for members only, so it is never shared as a link: the file itself goes. Where the browser cannot share
 * files the screen shows only the download.
 */

type ShareNavigator = Readonly<{
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}>;

type Fetch = (input: string) => Promise<Response>;

const probe = (name: string, type: string): ShareData => ({ files: [new File([""], name, { type })] });

export function canShareFiles(nav: ShareNavigator | undefined): boolean {
  return Boolean(nav?.share && nav.canShare?.(probe("probe.png", "image/png")));
}

export async function shareFile(href: string, filename: string, nav: ShareNavigator | undefined = typeof navigator === "undefined" ? undefined : navigator, fetcher: Fetch = fetch): Promise<{ ok: boolean }> {
  if (!nav?.share || !canShareFiles(nav)) return { ok: false };
  try {
    const response = await fetcher(href);
    if (!response.ok) return { ok: false };
    const blob = await response.blob();
    await nav.share({ files: [new File([blob], filename, { type: blob.type || "image/png" })], title: "Knitwright design" });
    return { ok: true };
  } catch (error) {
    // Closing the share sheet is a choice, not a failure.
    return { ok: error instanceof DOMException && error.name === "AbortError" };
  }
}
