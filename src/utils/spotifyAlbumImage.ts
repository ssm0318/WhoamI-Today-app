/**
 * Fetch album/thumbnail URL for a Spotify track via oEmbed (no auth).
 * Used when API returns track_id but not album_image_url (e.g. for widgets).
 */
export async function fetchSpotifyAlbumImageUrl(
  trackId: string,
): Promise<string | null> {
  if (!trackId || trackId.trim() === '') return null;
  try {
    const trackUrl = `https://open.spotify.com/track/${encodeURIComponent(
      trackId.trim(),
    )}`;
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return data?.thumbnail_url ?? null;
  } catch {
    return null;
  }
}
