import { useAnalytics, useFirebaseMessage, useNavigationService } from '@hooks';
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
  syncMyCheckInToWidget,
  triggerWidgetRefresh,
} from '../native/WidgetDataModule';
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
  const { handleLogout } = useAnalytics(tokens);

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
      setTokenLoadComplete(true);
    };

    fetchTokens();
  }, []);

  // 📸 Camera capture
  const openCamera = useCallback(() => {
    ImagePicker.openCamera({
      width: 300,
      height: 400,
      cropping: true,
      compressImageQuality: 0.8,
      includeBase64: true,
    })
      .then((image) => {
        sendFileToWeb(image);
      })
      .catch((error) => {
        console.log('Camera Error: ', error);
      });
  }, []);

  // 📂 Select file from gallery
  const openGallery = useCallback(() => {
    console.log('openGallery');
    ImagePicker.openPicker({
      width: 300,
      height: 400,
      cropping: true,
      multiple: false,
      compressImageQuality: 0.8,
      includeBase64: true,
    })
      .then((image) => {
        sendFileToWeb(image);
      })
      .catch((error) => {
        console.log('Gallery Error: ', error);
      });
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
        case 'CONSOLE':
          console.log('[WEBVIEW CONSOLE]', data.data);
          return;
        case 'OPEN_BROWSER':
          // Consider using openBrowserAsync in future updates
          await Linking.openURL(data.url);
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
          setTokens(parsedCookie);
          return saveCookie(parsedCookie);
        }
        case 'LOGOUT': {
          console.log('LOGOUT');

          // End session
          await handleLogout();

          // Unregister firebase push token
          await registerOrUpdatePushToken(tokens, false);

          await CookieStorage.removeCookie();
          setTokens({ csrftoken: '', access_token: '' });

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
                    mood?: string;
                    social_battery?: string | null;
                    description?: string;
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
                  mood: raw.mood ?? '',
                  socialBattery: raw.social_battery ?? null,
                  description: raw.description ?? '',
                  trackId: raw.track_id ?? '',
                  albumImageUrl,
                };
                await syncMyCheckInToWidget(payload);
                setCachedCheckInForWidget(payload);
                await triggerWidgetRefresh();
                // Trigger another refresh after a short delay to ensure widget updates
                setTimeout(() => {
                  triggerWidgetRefresh().catch(() => {
                    // Ignore errors on delayed refresh
                  });
                }, 500);
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
                  mood?: string;
                  social_battery?: string | null;
                  description?: string;
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
                  mood: checkIn.mood ?? '',
                  socialBattery: checkIn.social_battery ?? null,
                  description: checkIn.description ?? '',
                  trackId,
                  albumImageUrl,
                };
                await syncMyCheckInToWidget(payload);
                setCachedCheckInForWidget(payload);
              }
              await triggerWidgetRefresh();
              // Trigger another refresh after a short delay to ensure widget updates
              setTimeout(() => {
                triggerWidgetRefresh().catch(() => {
                  // Ignore errors on delayed refresh
                });
              }, 500);
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
    [openCamera, openGallery],
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
  };
};

export default useWebView;
