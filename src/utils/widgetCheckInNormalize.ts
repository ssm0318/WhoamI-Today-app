/**
 * API may return mood as string or list of emoji strings; the iOS widget expects a single string in JSON.
 */
export function normalizeMoodForWidget(mood: unknown): string {
  if (Array.isArray(mood)) {
    const first = mood[0];
    return typeof first === 'string' ? first : '';
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
