/**
 * API may return mood as a single string or a list of up to 5 emoji strings.
 * The widget shows one mood at a time, so pick a random entry from the list.
 */
export function normalizeMoodForWidget(mood: unknown): string {
  if (Array.isArray(mood)) {
    const strs = mood.filter(
      (m): m is string => typeof m === 'string' && m.length > 0,
    );
    if (strs.length === 0) return '';
    return strs[Math.floor(Math.random() * strs.length)];
  }
  if (typeof mood === 'string') {
    return mood;
  }
  return '';
}

/**
 * Backend uses `thought` (see check_in migration); older clients used `description`.
 */
export function normalizeDescriptionForWidget(checkIn: {
  description?: unknown;
  thought?: unknown;
}): string {
  const d = checkIn.description;
  const t = checkIn.thought;
  if (typeof d === 'string' && d.length > 0) {
    return d;
  }
  if (typeof t === 'string') {
    return t;
  }
  return '';
}
