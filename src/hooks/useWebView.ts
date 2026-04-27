import { useFirebaseMessage, useNavigationService } from '@hooks';
import {
  setAnalyticsUser,
  trackScreenView,
  AnalyticsUserProperties,
} from '../utils/analytics';
import {
  CookieStorage,
  parseCookie,
  redirectSetting,
  saveCookie,
} from '@tools';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  WebViewMessageEvent,
  WebView,
  type WebViewNavigation,
} from 'react-native-webview';
import { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { ScreenRouteParamList } from '@screens';
import ImagePicker from 'react-native-image-crop-picker';
import {
  clearAllWidgetDataForLogout,
  clearFriendUpdateFromWidget,
  clearMyCheckInFromWidget,
  clearSharedPlaylistTrackFromWidget,
  clearWidgetTokens,
  getWidgetDiagnostics,
  syncMyCheckInToWidget,
  syncTokensToWidget,
  triggerWidgetRefresh,
} from '../native/WidgetDataModule';
import {
  normalizeDescriptionForWidget,
  normalizeMoodForWidget,
} from '../utils/widgetCheckInNormalize';
import { setWidgetDataStale } from '../utils/widgetDataStale';
import { setCachedCheckInForWidget } from '../utils/widgetCheckInCache';
import { fetchSpotifyAlbumImageUrl } from '../utils/spotifyAlbumImage';
import ApiService from '../apis/API';

interface FileData {
  uri: string;
  type: string;
  name: string;
  base64?: string;
}

const useWebView = () => {
  const [loadProgress, setLoadProgress] = useState(0);
  const ref = useRef<WebView>(null);
  const navigation = useNavigationService();
  const [tokens, setTokens] = useState({ csrftoken: '', access_token: '' });
  const [tokenLoadComplete, setTokenLoadComplete] = useState(false);
  const { getCookie } = CookieStorage;
  const { registerOrUpdatePushToken } = useFirebaseMessage();
  const [isCanGoBack, setIsCanGoBack] = useState(false);

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setIsCanGoBack(navState.canGoBack ?? false);
  }, []);

  const postMessage = useCallback((key: string, data: any) => {
    ref.current?.postMessage(JSON.stringify({ key, data }));
  }, []);

  const injectCookieScript = useCallback(
    (csrftoken: string, access_token: string) => {
      return `
        document.cookie = 'csrftoken=${csrftoken};path=/';
        document.cookie = 'access_token=${access_token};path=/';
      `;
    },
    [],
  );

  useEffect(() => {
    const fetchTokens = async () => {
      const { access_token, csrftoken } = await getCookie();
      setTokens({ access_token, csrftoken });
      // Push tokens to the App Group before WebView mounts so home-screen widgets
      // (Check-in reads csrftoken/access_token) see auth even if runWidgetSync runs later.
      if (access_token && csrftoken) {
        try {
          await syncTokensToWidget(csrftoken, access_token);
          console.log(
            '[WidgetSync] Tokens synced to widget storage after AsyncStorage load',
          );
        } catch (e) {
          console.warn('[WidgetSync] Early syncTokensToWidget failed:', e);
        }
      }
      setTokenLoadComplete(true);
    };

    fetchTokens();
  }, []);

  const sendFileToWeb = useCallback(
    (image: any) => {
      const fileData: FileData = {
        uri: image.path,
        type: image.mime,
        name: image.path.split('/').pop() || 'upload.jpg',
        base64: image.data,
      };

      postMessage('FILE_SELECTED', fileData);
    },
    [postMessage],
  );

  // 📸 Camera capture (image or video)
  const openCamera = useCallback(() => {
    ImagePicker.openCamera({
      mediaType: 'any',
      compressImageQuality: 0.8,
      compressVideoPreset: 'MediumQuality',
      includeBase64: true,
    })
      .then(async (media) => {
        if (media.mime?.startsWith('video/')) {
          try {
            const RNFetchBlob = (await import('rn-fetch-blob')).default;
            const base64Data = await RNFetchBlob.fs.readFile(
              media.path,
              'base64',
            );
            const fileData: FileData = {
              uri: media.path,
              type: media.mime || 'video/mp4',
              name: media.path.split('/').pop() || 'video.mp4',
              base64: base64Data,
            };
            postMessage('FILE_SELECTED', { ...fileData, isVideo: true });
          } catch (err) {
            console.log('Video base64 conversion error:', err);
          }
        } else {
          sendFileToWeb(media);
        }
      })
      .catch((error) => {
        console.log('Camera Error: ', error);
      });
  }, [postMessage, sendFileToWeb]);

  // 📂 Select file from gallery (image or video)
  const openGallery = useCallback(() => {
    console.log('openGallery');
    ImagePicker.openPicker({
      mediaType: 'any',
      multiple: false,
      compressImageQuality: 0.8,
      compressVideoPreset: 'MediumQuality',
      includeBase64: true,
    })
      .then(async (media) => {
        if (media.mime?.startsWith('video/')) {
          try {
            const RNFetchBlob = (await import('rn-fetch-blob')).default;
            const base64Data = await RNFetchBlob.fs.readFile(
              media.path,
              'base64',
            );
            const fileData: FileData = {
              uri: media.path,
              type: media.mime || 'video/mp4',
              name: media.path.split('/').pop() || 'video.mp4',
              base64: base64Data,
            };
            postMessage('FILE_SELECTED', { ...fileData, isVideo: true });
          } catch (err) {
            console.log('Video base64 conversion error:', err);
          }
        } else {
          sendFileToWeb(media);
        }
      })
      .catch((error) => {
        console.log('Gallery Error: ', error);
      });
  }, [postMessage, sendFileToWeb]);

  // 🎬 Video from gallery
  const openVideoGallery = useCallback(() => {
    ImagePicker.openPicker({
      mediaType: 'video',
      compressVideoPreset: 'MediumQuality',
    })
      .then(async (video) => {
        try {
          const RNFetchBlob = (await import('rn-fetch-blob')).default;
          const base64Data = await RNFetchBlob.fs.readFile(
            video.path,
            'base64',
          );
          const fileData: FileData = {
            uri: video.path,
            type: video.mime || 'video/mp4',
            name: video.path.split('/').pop() || 'video.mp4',
            base64: base64Data,
          };
          postMessage('FILE_SELECTED', { ...fileData, isVideo: true });
        } catch (err) {
          console.log('Video base64 conversion error:', err);
        }
      })
      .catch((error) => {
        console.log('Video Gallery Error:', error);
      });
  }, [postMessage]);

  // 🎬 Video from camera
  const openVideoCamera = useCallback(() => {
    ImagePicker.openCamera({
      mediaType: 'video',
      compressVideoPreset: 'MediumQuality',
    })
      .then(async (video) => {
        try {
          const RNFetchBlob = (await import('rn-fetch-blob')).default;
          const base64Data = await RNFetchBlob.fs.readFile(
            video.path,
            'base64',
          );
          const fileData: FileData = {
            uri: video.path,
            type: video.mime || 'video/mp4',
            name: video.path.split('/').pop() || 'video.mp4',
            base64: base64Data,
          };
          postMessage('FILE_SELECTED', { ...fileData, isVideo: true });
        } catch (err) {
          console.log('Video base64 conversion error:', err);
        }
      })
      .catch((error) => {
        console.log('Video Camera Error:', error);
      });
  }, [postMessage]);

  /**
   * Handle requests from webview
   */
  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      // Handle special case for navigation state change
      if (event.nativeEvent.data === 'navigationStateChange') {
        setIsCanGoBack(event.nativeEvent.canGoBack);
        return;
      }

      // Try to parse the data as JSON
      let data;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch (error) {
        console.warn(
          'JSON parsing error:',
          error,
          'Data:',
          event.nativeEvent.data,
        );
        return;
      }

      // Handle specific action types
      if (!('actionType' in data)) return;

      console.log('[useWebView] Web action received:', data.actionType);

      switch (data.actionType) {
        case 'CONSOLE': {
          const logFn =
            data.type && typeof (console as any)[data.type] === 'function'
              ? (console as any)[data.type]
              : console.log;
          logFn(
            `[WEBVIEW ${String(data.type || 'log').toUpperCase()}]`,
            data.data,
          );
          return;
        }
        case 'OPEN_BROWSER':
          // Consider using openBrowserAsync in future updates
          await Linking.openURL(data.url);
          return;
        case 'OPEN_VIDEO':
          if (data.url) {
            navigation.navigate('VideoScreen', { url: data.url });
          }
          return;
        case 'NAVIGATE': {
          if (!data.screenName) return;
          return navigation.push(
            data.screenName as keyof ScreenRouteParamList,
            {
              ...data.params,
            },
          );
        }
        case 'OPEN_SETTING':
          return redirectSetting();
        case 'SET_COOKIE': {
          const parsedCookie = parseCookie(data.value);
          const prevTokens = await CookieStorage.getCookie();
          const mergedCookie = {
            csrftoken: parsedCookie.csrftoken || prevTokens.csrftoken || '',
            access_token:
              parsedCookie.access_token || prevTokens.access_token || '',
          };
          // Persist to AsyncStorage/CookieManager BEFORE updating React state.
          // The axios interceptor (apis/API.ts) reads tokens from CookieStorage
          // asynchronously; if setTokens ran first, the token-driven useEffect
          // would fire runWidgetSync → profile API call before AsyncStorage had
          // the new tokens, and the interceptor would reject with "Missing
          // authentication tokens" — leaving the widget on the previous
          // account's data after account switch.
          if (mergedCookie.csrftoken && mergedCookie.access_token) {
            await saveCookie(mergedCookie);
            await syncTokensToWidget(
              mergedCookie.csrftoken,
              mergedCookie.access_token,
            );
            await triggerWidgetRefresh();
          } else {
            console.log(
              '[WidgetSync] SET_COOKIE skipped: incomplete token pair',
              {
                parsed: {
                  hasCsrf: !!parsedCookie.csrftoken,
                  hasAccess: !!parsedCookie.access_token,
                },
                merged: {
                  hasCsrf: !!mergedCookie.csrftoken,
                  hasAccess: !!mergedCookie.access_token,
                },
              },
            );
          }
          setTokens(mergedCookie);
          return;
        }
        case 'LOGOUT': {
          console.log('LOGOUT');

          // Prioritize widget sign-out UX first. If app lifecycle changes quickly
          // (e.g. user goes home immediately), widget storage is already cleared.
          await clearAllWidgetDataForLogout();
          await triggerWidgetRefresh();

          // Unregister push token in best-effort mode; never block logout cleanup.
          await registerOrUpdatePushToken(tokens, false).catch((e) => {
            console.warn(
              '[WidgetSync] Push token unregister failed during logout',
              e,
            );
          });

          await CookieStorage.removeCookie();
          setTokens({ csrftoken: '', access_token: '' });
          setCachedCheckInForWidget(null);
          setWidgetDataStale(true);

          // Fallback clear calls keep compatibility if older native bridge is loaded.
          await Promise.allSettled([
            clearWidgetTokens(),
            clearMyCheckInFromWidget(),
            clearSharedPlaylistTrackFromWidget(),
            clearFriendUpdateFromWidget(),
          ]);
          await triggerWidgetRefresh();

          // Improved WebView cookie and storage cleanup
          ref.current?.injectJavaScript(`
          (function() {
            // Clear cookies
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
              const cookie = cookies[i];
              const eqPos = cookie.indexOf('=');
              const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
              document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
              document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
            }
            
            // Clear storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear cache and reload
            if (window.caches) {
              caches.keys().then(function(names) {
                for (let name of names) caches.delete(name);
              });
            }
            
            // Force reload from server
            window.location.reload(true);
          })();
        `);

          return;
        }
        case 'OPEN_GALLERY':
          openGallery();
          return;
        case 'OPEN_CAMERA':
          openCamera();
          return;
        case 'OPEN_VIDEO_GALLERY':
          openVideoGallery();
          return;
        case 'OPEN_VIDEO_CAMERA':
          openVideoCamera();
          return;
        case 'ANALYTICS_PAGE_VIEW': {
          const { page_name, page_path } = data;
          trackScreenView(page_name, page_path);
          return;
        }
        case 'ANALYTICS_SET_USER': {
          const { user_id, ...properties } = data;
          setAnalyticsUser(user_id, properties as AnalyticsUserProperties);
          return;
        }
        case 'WIDGET_DATA_UPDATED': {
          // If web sends check_in in the message (when user saves check-in), use it so widget
          // matches the app screen without waiting for API. Otherwise fetch from API.
          console.log(
            '[WidgetSync] WIDGET_DATA_UPDATED received from WebView',
            {
              hasCheckInPayload: !!data.check_in,
              payload: data.check_in,
            },
          );
          setWidgetDataStale(true);
          (async () => {
            try {
              const raw = data.check_in as
                | {
                    id?: number;
                    is_active?: boolean;
                    created_at?: string;
                    mood?: string | string[];
                    social_battery?: string | null;
                    description?: string;
                    thought?: string;
                    track_id?: string;
                    album_image_url?: string | null;
                  }
                | undefined;
              if (raw && typeof raw.id === 'number') {
                console.log(
                  '[WidgetSync] WIDGET_DATA_UPDATED: using inline payload (id=' +
                    raw.id +
                    ')',
                );
                let albumImageUrl: string | null = raw.album_image_url ?? null;
                if (!albumImageUrl && raw.track_id?.trim()) {
                  albumImageUrl = await fetchSpotifyAlbumImageUrl(raw.track_id);
                }
                const payload = {
                  id: raw.id,
                  isActive: raw.is_active ?? true,
                  createdAt: raw.created_at ?? '',
                  mood: normalizeMoodForWidget(raw.mood),
                  socialBattery: raw.social_battery ?? null,
                  description: normalizeDescriptionForWidget(raw),
                  trackId: raw.track_id ?? '',
                  albumImageUrl,
                };
                await syncMyCheckInToWidget(payload);
                setCachedCheckInForWidget(payload);

                // Q1 verification: before firing reloads, read back what's actually in
                // the App Group so we can distinguish a failed write from a failed reload.
                try {
                  const diag = await getWidgetDiagnostics();
                  let persistedBattery: unknown = '(no-diag)';
                  if (diag?.myCheckInJsonFile) {
                    try {
                      persistedBattery = JSON.parse(
                        diag.myCheckInJsonFile,
                      ).social_battery;
                    } catch {
                      persistedBattery = '(parse-failed)';
                    }
                  }
                  console.log(
                    '[WidgetSync] WIDGET_DATA_UPDATED: post-write verification',
                    {
                      expectedBattery: payload.socialBattery,
                      persistedBattery,
                      fileLen: diag?.myCheckInJsonFile?.length ?? 0,
                      defaultsLen: diag?.myCheckInJson?.length ?? 0,
                    },
                  );
                } catch (diagErr) {
                  console.warn(
                    '[WidgetSync] post-write verification failed',
                    diagErr,
                  );
                }

                // syncMyCheckInToWidget now triggers a kind-specific reload
                // (CheckinWidgetV3) internally, so calling triggerWidgetRefresh
                // here would burn album/photo widget reload budgets unnecessarily.
                return;
              }
              console.log(
                '[WidgetSync] WIDGET_DATA_UPDATED: no inline payload, fetching from API',
              );
              const [profileResponse, songResponse] = await Promise.all([
                ApiService.API.get('user/me/profile') as Promise<unknown>,
                ApiService.API.get('check_in/song/').catch(
                  () => [],
                ) as Promise<unknown>,
              ]);
              const res = profileResponse as {
                check_in?: {
                  id: number;
                  is_active: boolean;
                  created_at: string;
                  mood?: string | string[];
                  social_battery?: string | null;
                  description?: string;
                  thought?: string;
                };
              };
              // /check_in/song/ returns DRF-paginated shape: { count, next, previous, results: [...] }
              type SongItem = { track_id: string; is_active: boolean };
              const songsResRaw = songResponse as
                | SongItem[]
                | { results?: SongItem[] }
                | null
                | undefined;
              let songsList: SongItem[] = [];
              if (Array.isArray(songsResRaw)) {
                songsList = songsResRaw;
              } else if (songsResRaw && Array.isArray(songsResRaw.results)) {
                songsList = songsResRaw.results as SongItem[];
              }
              console.log('[WidgetSync] WIDGET_DATA_UPDATED: API responses', {
                hasCheckInInProfile: !!res?.check_in,
                checkInRaw: res?.check_in,
                songsListLen: songsList.length,
                songsRaw: songsResRaw,
              });
              const trackId =
                songsList.find((s) => s.is_active)?.track_id ?? '';
              const checkIn = res?.check_in;
              if (checkIn) {
                let albumImageUrl: string | null = null;
                if (trackId.trim()) {
                  albumImageUrl = await fetchSpotifyAlbumImageUrl(trackId);
                }
                const payload = {
                  id: checkIn.id,
                  isActive: checkIn.is_active,
                  createdAt: checkIn.created_at,
                  mood: normalizeMoodForWidget(checkIn.mood),
                  socialBattery: checkIn.social_battery ?? null,
                  description: normalizeDescriptionForWidget(checkIn),
                  trackId,
                  albumImageUrl,
                };
                await syncMyCheckInToWidget(payload);
                setCachedCheckInForWidget(payload);
              }
              // syncMyCheckInToWidget above triggers a kind-specific reload
              // internally — no all-kinds triggerWidgetRefresh needed.
              void getWidgetDiagnostics();
            } catch (err) {
              console.warn('[WidgetSync] WIDGET_DATA_UPDATED failed:', err);
              await triggerWidgetRefresh();
            }
          })();
          return;
        }
        default:
          return;
      }
    },
    [openCamera, openGallery, openVideoGallery, openVideoCamera],
  );

  const onLoadProgress = useCallback((e: WebViewProgressEvent) => {
    setLoadProgress(e.nativeEvent.progress);
  }, []);

  return {
    ref,
    loadProgress,
    onMessage,
    onLoadProgress,
    onNavigationStateChange,
    postMessage,
    injectCookieScript,
    tokens,
    tokenLoadComplete,
    isCanGoBack,
    openCamera,
    openGallery,
    openVideoGallery,
    openVideoCamera,
  };
};

export default useWebView;
