/**
 * Cache of the last check-in synced to the widget. Used so that when the app
 * goes to inactive we can push this to the widget and call reload immediately
 * (no network), improving the chance iOS honors reloadAllTimelines() before
 * the app is fully in background.
 */

export type CachedCheckIn = {
  id: number;
  isActive: boolean;
  createdAt: string;
  mood: string;
  socialBattery: string | null;
  description: string;
  trackId: string;
  albumImageUrl: string | null;
};

let cached: CachedCheckIn | null = null;

export const getCachedCheckInForWidget = (): CachedCheckIn | null => cached;

export const setCachedCheckInForWidget = (
  checkIn: CachedCheckIn | null,
): void => {
  cached = checkIn;
};
