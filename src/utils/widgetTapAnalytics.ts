import { trackEvent } from './analytics';

type WidgetKind =
  | 'shared_playlist'
  | 'friend_update'
  | 'checkin'
  | 'unauthenticated';
type CheckinEditor = 'mood' | 'battery' | 'song' | 'thought';

type WidgetTapInfo = {
  widget_kind: WidgetKind;
  editor?: CheckinEditor;
};

const VALID_EDITORS: readonly CheckinEditor[] = [
  'mood',
  'battery',
  'song',
  'thought',
];

function getQueryParam(url: string, key: string): string | null {
  const queryIdx = url.indexOf('?');
  if (queryIdx === -1) return null;
  const query = url.slice(queryIdx + 1);
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const k = pair.slice(0, eq);
    if (k !== key) continue;
    try {
      return decodeURIComponent(pair.slice(eq + 1));
    } catch {
      return pair.slice(eq + 1);
    }
  }
  return null;
}

export function parseWidgetTap(url: string): WidgetTapInfo | null {
  if (!url || !url.startsWith('whoami://')) return null;
  // Refresh URLs are widget-internal reloads, not user-facing taps.
  const rest = url.slice('whoami://'.length).replace(/^\/+/, '');
  if (rest.startsWith('widget-refresh') || rest.startsWith('widget/refresh')) {
    return null;
  }
  if (rest.startsWith('app/login')) {
    return { widget_kind: 'unauthenticated' };
  }
  if (rest.startsWith('app/discover')) {
    return { widget_kind: 'shared_playlist' };
  }
  if (rest.startsWith('app/friends')) {
    return { widget_kind: 'friend_update' };
  }
  if (rest.startsWith('app/update')) {
    const editor = getQueryParam(url, 'editor');
    if (editor && (VALID_EDITORS as readonly string[]).includes(editor)) {
      return { widget_kind: 'checkin', editor: editor as CheckinEditor };
    }
    return { widget_kind: 'checkin' };
  }
  return null;
}

// Cold start can deliver the same URL through getInitialURL, then again through
// the iOS onReady retry path. Dedup within a short window so we log once per tap.
const DEDUP_TTL_MS = 10_000;
let lastTracked: { url: string; at: number } | null = null;

export function trackWidgetTap(url: string | null | undefined): void {
  if (!url) return;
  const info = parseWidgetTap(url);
  if (!info) return;

  const now = Date.now();
  if (
    lastTracked &&
    lastTracked.url === url &&
    now - lastTracked.at < DEDUP_TTL_MS
  ) {
    return;
  }
  lastTracked = { url, at: now };

  const params: Record<string, string> = { widget_kind: info.widget_kind };
  if (info.editor) params.editor = info.editor;
  trackEvent('widget_tapped', params);
}
