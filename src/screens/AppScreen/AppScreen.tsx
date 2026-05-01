import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  NativeModules,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_CONSTS, WEBVIEW_CONSTS } from '@constants';
import {
  useFocusEffect,
  useNavigation,
  CommonActions,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import {
  useAppStateActiveEffect,
  useAsyncEffect,
  useFirebaseMessage,
  useWebView,
  useVersionCheckUpdate,
  useAppStateEffect,
} from '@hooks';
import RNFetchBlob from 'rn-fetch-blob';
import ApiService from '../../apis/API';
import {
  getWidgetDiagnostics,
  syncSpotifyCredentialsToWidget,
  syncMyCheckInToWidget,
  syncSharedPlaylistTrackToWidget,
  syncFriendUpdateToWidget,
  clearFriendUpdateFromWidget,
  FriendUpdatePayload,
  syncTokensToWidget,
  triggerWidgetRefresh,
} from '../../native/WidgetDataModule';
import {
  normalizeDescriptionForWidget,
  normalizeMoodForWidget,
} from '../../utils/widgetCheckInNormalize';
import {
  getCachedCheckInForWidget,
  setCachedCheckInForWidget,
} from '../../utils/widgetCheckInCache';
import { setWidgetDataStale } from '../../utils/widgetDataStale';
import { fetchSpotifyAlbumImageUrl } from '../../utils/spotifyAlbumImage';

// Fetch a remote image and return its base64-encoded body (no `data:...;base64,` prefix).
// Returns empty string on any failure so the native side just clears that image slot.
async function fetchImageAsBase64(
  url: string | null | undefined,
): Promise<string> {
  if (!url || !url.trim()) return '';
  try {
    const res = await RNFetchBlob.fetch('GET', url);
    return res.base64();
  } catch (err) {
    console.warn('[WidgetSync] fetchImageAsBase64 failed for', url, err);
    return '';
  }
}

const BASE_URL = APP_CONSTS.WEB_VIEW_URL;

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { url = '/' } = route.params ?? {};
  const isDeepLinkPath = url !== '/' && url !== '';
  // Load the target URL directly instead of root → JS redirect (saves one full page load).
  const initialUri = BASE_URL + (url || '/');
  const deepLinkBackToBaseDoneRef = useRef(false);

  const {
    ref,
    onMessage,
    onNavigationStateChange,
    postMessage,
    injectCookieScript,
    tokens,
    tokenLoadComplete,
    isCanGoBack,
  } = useWebView();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [isWebViewLoaded, setWebViewLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const latestTokensRef = useRef(tokens);
  useEffect(() => {
    latestTokensRef.current = tokens;
  }, [tokens]);
  const { registerOrUpdatePushToken, hasPermission, requestPermissionIfNot } =
    useFirebaseMessage();

  // Automatically perform version check and update
  // Detect version changes
  const { versionChanged, resetVersionChanged } = useVersionCheckUpdate(tokens);

  // Reload on version change (rare, after the initial load).
  // Reset the flag so a future change can trigger another reload.
  useEffect(() => {
    if (versionChanged && ref.current) {
      console.log('[AppScreen] Version changed, reloading WebView');
      ref.current.reload();
      resetVersionChanged();
    }
  }, [versionChanged, resetVersionChanged]);

  // Modified to check only when returning to app after changing push permission settings
  useAppStateActiveEffect(async () => {
    const enabled = await hasPermission();
    postMessage('SET_NOTI_PERMISSION', { value: enabled });
    if (!tokens.access_token || !tokens.csrftoken) return;
    if (enabled) {
      await registerOrUpdatePushToken(tokens, true);
    } else {
      await registerOrUpdatePushToken(tokens, false);
    }
  });

  // Only request initial permission, do not register token
  useAsyncEffect(async () => {
    const enabled = await requestPermissionIfNot();
    postMessage('SET_NOTI_PERMISSION', { value: enabled });
  }, []);

  // Sync Spotify credentials to widget on app start
  useEffect(() => {
    syncSpotifyCredentialsToWidget(
      APP_CONSTS.SPOTIFY_CLIENT_ID,
      APP_CONSTS.SPOTIFY_CLIENT_SECRET,
    );
  }, []);

  const onPressHardwareBackButtonRef = useRef<() => boolean>(() => false);
  onPressHardwareBackButtonRef.current = () => {
    // Deep link → main: use navigation reset so it works even when WebView ref is not ready
    if (isDeepLinkPath && !deepLinkBackToBaseDoneRef.current) {
      deepLinkBackToBaseDoneRef.current = true;
      NativeModules.InitialURLModule?.clearStoredInitialURL?.();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AppScreen', params: { url: '/' } }],
        }),
      );
      return true;
    }
    if (ref.current && isCanGoBack) {
      ref.current.goBack();
      return true;
    }
    return false;
  };

  useFocusEffect(
    React.useCallback(() => {
      const handler = () => onPressHardwareBackButtonRef.current();
      const backPressSubscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handler,
      );
      return () => backPressSubscription.remove();
    }, []),
  );

  // When web is opened via deep link, router.back() has no history. Web sends NAVIGATE_TO_BASE; we inject flag + replace so web can skip "restore route" on load.
  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const raw = event.nativeEvent.data;
      try {
        const data = JSON.parse(raw);
        if (data?.actionType === 'NAVIGATE_TO_BASE') {
          NativeModules.InitialURLModule?.clearStoredInitialURL?.();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'AppScreen', params: { url: '/' } }],
            }),
          );
          const base = BASE_URL.replace(/\/+$/, '') + '/';
          ref.current?.injectJavaScript(
            `(function(){sessionStorage.setItem('from_navigate_to_base','1');location.replace(${JSON.stringify(
              base,
            )});})();true;`,
          );
          return;
        }
      } catch {
        // not JSON or other message
      }
      onMessage(event as Parameters<typeof onMessage>[0]);
    },
    [onMessage],
  );

  // Function to send keyboard height to WebView (Android only)
  const sendKeyboardHeightToWebView = (height: number) => {
    if (Platform.OS === 'android' && ref.current) {
      const message = JSON.stringify({
        type: 'KEYBOARD_HEIGHT',
        height: height,
      });
      ref.current.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', {
          data: '${message}'
        }));
        true;
      `);
    }
  };

  // Keyboard event listener (Android only)
  useEffect(() => {
    // Do not handle keyboard events on iOS
    if (Platform.OS !== 'android') return;

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        const height = event.endCoordinates.height;
        setKeyboardHeight(height);
        sendKeyboardHeightToWebView(height);
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        sendKeyboardHeightToWebView(0);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Adjust WebView padding when keyboard is shown (Android only)
  useEffect(() => {
    // Do not handle keyboard-related processing on iOS
    if (Platform.OS !== 'android') return;

    const onShow = (e: { endCoordinates: { height: number } }) => {
      const kbHeight = e.endCoordinates.height;
      // Inject JS into webview: add bottom padding to body
      ref.current?.injectJavaScript(`
        document.body.style.paddingBottom='${kbHeight}px';
        var el = document.activeElement;
        if(el && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest' }); }
      `);
    };
    const onHide = () => {
      ref.current?.injectJavaScript(`document.body.style.paddingBottom='0px';`);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Function to conditionally render KeyboardAvoidingView based on platform
  const renderContent = () => {
    if (Platform.OS === 'android') {
      // Use KeyboardAvoidingView on Android
      return (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {renderWebView()}
        </KeyboardAvoidingView>
      );
    } else {
      // Render WebView directly without KeyboardAvoidingView on iOS
      return renderWebView();
    }
  };

  // WebView rendering function: deep link → load base first, then redirect in onLoadEnd
  const renderWebView = () => {
    // Wait until token loading is complete before rendering WebView
    // This avoids a useless first load with empty cookies followed by a reload
    if (!tokenLoadComplete) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      );
    }
    return (
      <WebView
        key={initialUri}
        ref={ref}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={onNavigationStateChange}
        source={{
          uri: initialUri,
        }}
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: '#FFFFFF' }}
        injectedJavaScriptBeforeContentLoaded={injectCookieScript(
          tokens.csrftoken,
          tokens.access_token,
        )}
        allowsBackForwardNavigationGestures
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        setSupportMultipleWindows={true}
        androidLayerType="hardware"
        decelerationRate="normal"
        javaScriptEnabled
        injectedJavaScript={WEBVIEW_CONSTS.WEB_VIEW_DEBUGGING_SCRIPT}
        originWhitelist={['*']}
        scalesPageToFit={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={true}
        cacheMode={Platform.OS === 'android' ? 'LOAD_DEFAULT' : undefined}
        domStorageEnabled
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        /* Keyboard-related settings - apply platform-specific differences */
        scrollEnabled={true}
        keyboardDisplayRequiresUserAction={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : 'never'
        }
        startInLoadingState={!isWebViewLoaded}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            {!isWebViewLoaded && (
              <ActivityIndicator size="large" color="#0000ff" />
            )}
          </View>
        )}
        onLoadEnd={() => {
          setIsLoading(false);
          if (!isWebViewLoaded) {
            setWebViewLoaded(true);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onRenderProcessGone={(syntheticEvent) => {
          console.warn('WebView crashed, reloading...');
          ref.current?.reload();
        }}
        onContentProcessDidTerminate={(syntheticEvent) => {
          console.warn('WebView crashed, reloading...');
          ref.current?.reload();
        }}
      />
    );
  };

  // Send to webview when app state changes
  useAppStateEffect((state) => {
    console.log('[AppScreen] App state changed:', state);
    postMessage('SET_APP_STATE', { value: state });
  }, []);

  type WidgetSyncMode = 'foreground' | 'background';

  // Sync latest widget data. In background mode we only do cheap/local sync because
  // iOS may suspend JS before network-heavy shared/friend flows finish.
  const runWidgetSync = useCallback(
    (mode: WidgetSyncMode = 'foreground') => {
      const startedWith = {
        accessToken: tokens.access_token,
        csrfToken: tokens.csrftoken,
      };
      const isSyncStillValid = () => {
        const current = latestTokensRef.current;
        return (
          !!startedWith.accessToken &&
          !!startedWith.csrfToken &&
          current.access_token === startedWith.accessToken &&
          current.csrftoken === startedWith.csrfToken
        );
      };

      console.log('[WidgetSync] runWidgetSync called', {
        mode,
        hasAccessToken: !!tokens.access_token,
        hasCsrfToken: !!tokens.csrftoken,
      });
      if (!tokens.access_token || !tokens.csrftoken) {
        console.log('[WidgetSync] runWidgetSync skipped: missing tokens');
        return;
      }
      setWidgetDataStale(false);

      // Force-push auth tokens to App Group every sync. If the user is already logged in
      // from a previous session, WebView reuses cached cookies and never re-fires SET_COOKIE,
      // which means syncTokensToWidget (normally called from saveCookie) is never invoked —
      // and the widget extension reads empty tokens and renders SignInView.
      syncTokensToWidget(tokens.csrftoken, tokens.access_token).catch(() => {
        /* logged inside the wrapper */
      });

      const cachedCheckIn = getCachedCheckInForWidget();
      if (cachedCheckIn) {
        console.log('[WidgetSync] Pushing cached check-in first', {
          id: cachedCheckIn.id,
          mood: cachedCheckIn.mood,
          descriptionLen: cachedCheckIn.description?.length ?? 0,
        });
        // syncMyCheckInToWidget triggers a kind-specific CheckinWidgetV3 reload
        // internally — no all-kinds triggerWidgetRefresh needed here.
        syncMyCheckInToWidget(cachedCheckIn).catch(() => {
          /* logged inside the wrapper */
        });
      } else {
        console.log('[WidgetSync] No cached check-in to push immediately');
      }

      if (mode === 'background') {
        console.log(
          '[WidgetSync] Background mode: skipping network-heavy shared/friend sync',
        );
        triggerWidgetRefresh().catch(() => {
          /* logged inside wrapper */
        });
        return;
      }

      (async () => {
        try {
          console.log('[WidgetSync] Fetching profile + song from API…');
          const [profileResponse, songResponse] = await Promise.all([
            ApiService.API.get('user/me/profile') as Promise<unknown>,
            ApiService.API.get('check_in/song/').catch(
              () => [],
            ) as Promise<unknown>,
          ]);
          if (!isSyncStillValid()) {
            console.log(
              '[WidgetSync] Aborting stale sync: token context changed',
            );
            return;
          }
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
          // (older deployments may return a bare array — handle both)
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
          console.log('[WidgetSync] API responses received', {
            hasCheckInInProfile: !!res?.check_in,
            checkInRaw: res?.check_in,
            songsListLen: songsList.length,
            songsRaw: songsResRaw,
          });
          const trackId = songsList.find((s) => s.is_active)?.track_id ?? '';
          const checkIn = res?.check_in;
          if (checkIn) {
            let albumImageUrl: string | null = null;
            if (trackId.trim()) {
              console.log(
                '[WidgetSync] Fetching Spotify album image for',
                trackId,
              );
              albumImageUrl = await fetchSpotifyAlbumImageUrl(trackId);
              console.log('[WidgetSync] Album image url:', albumImageUrl);
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
            console.log('[WidgetSync] Final payload to sync:', payload);
            await syncMyCheckInToWidget(payload);
            setCachedCheckInForWidget(payload);
          } else {
            console.warn(
              '[WidgetSync] API returned no check_in in profile — widget will show empty state',
            );
          }

          // ── Shared playlist sync (independent from myCheckIn) ──
          // Fetches /user/discover/?page=1 → picks a random music_track → fetches album art
          // and sharer avatar as base64 → syncs to AlbumCoverWidget. Wrapped in its own try/catch
          // so a discover-feed failure can't break the myCheckIn flow.
          try {
            console.log(
              '[WidgetSync] Fetching shared playlist from /user/discover/?page=1',
            );
            const discoverResponse = (await ApiService.API.get(
              'user/discover/',
              {
                params: { page: 1 },
              },
            )) as {
              music_tracks?: Array<{
                id: number;
                track_id: string;
                created_at: string;
                user: {
                  id: number;
                  username: string;
                  profile_image?: string | null;
                  profile_pic?: string | null;
                };
              }>;
            };
            const musicTracks = discoverResponse?.music_tracks ?? [];
            console.log(
              '[WidgetSync] Shared playlist tracks count:',
              musicTracks.length,
            );
            if (musicTracks.length > 0) {
              const randomIdx = Math.floor(Math.random() * musicTracks.length);
              const picked = musicTracks[randomIdx];
              const sharerProfileImageUrl = picked.user.profile_image ?? null;
              console.log('[WidgetSync] Picked random shared track:', {
                idx: randomIdx,
                id: picked.id,
                trackId: picked.track_id,
                sharerUsername: picked.user.username,
                hasProfileImage: !!sharerProfileImageUrl,
              });
              const albumImageUrl = await fetchSpotifyAlbumImageUrl(
                picked.track_id,
              );
              console.log(
                '[WidgetSync] Shared track album image url:',
                albumImageUrl,
              );
              const [albumImageBase64, avatarImageBase64] = await Promise.all([
                fetchImageAsBase64(albumImageUrl),
                fetchImageAsBase64(sharerProfileImageUrl),
              ]);
              console.log('[WidgetSync] Shared playlist images fetched', {
                albumImageBase64Len: albumImageBase64.length,
                avatarImageBase64Len: avatarImageBase64.length,
              });
              await syncSharedPlaylistTrackToWidget(
                {
                  id: picked.id,
                  trackId: picked.track_id,
                  albumImageUrl,
                  sharerUsername: picked.user.username,
                  sharerProfileImageUrl,
                },
                albumImageBase64,
                avatarImageBase64,
              );
              if (!isSyncStillValid()) {
                console.log(
                  '[WidgetSync] Aborting stale sync after shared playlist write',
                );
                return;
              }
              console.log(
                '[WidgetSync] Shared playlist synced to native; verifying App Group…',
              );
              void getWidgetDiagnostics();
            } else {
              console.warn(
                '[WidgetSync] No music_tracks in discover feed — AlbumCoverWidget will show placeholder',
              );
              console.warn('[WidgetSync] discover response keys:', {
                keys: Object.keys(discoverResponse ?? {}),
                preview: JSON.stringify(discoverResponse ?? {}).slice(0, 800),
              });
            }
          } catch (spErr) {
            console.warn('[WidgetSync] Shared playlist sync failed:', spErr);
          }

          // ── Friend update sync ──
          // Picks a random friend with a check-in or post update and syncs one
          // representative update (post prioritized over check-in) to the
          // Friend Update Widget. Check-in variation follows last_updated_field.
          try {
            console.log(
              '[WidgetSync] Fetching friend list from /user/friends/',
            );
            // Raw fetch to compare with axios path
            try {
              const CookieManagerModule = require('@react-native-cookies/cookies');
              const CM = CookieManagerModule?.default ?? CookieManagerModule;
              const cookies = await CM.get(
                'https://whoami-test-group.gina-park.site',
                true,
              );
              console.log('[WidgetSync] Raw cookies from CookieManager:', {
                keys: Object.keys(cookies || {}),
                csrftoken: cookies?.csrftoken?.value?.slice(0, 10),
                accessTokenStart: cookies?.access_token?.value?.slice(0, 10),
              });
              const csrf = cookies?.csrftoken?.value ?? '';
              const accessToken = cookies?.access_token?.value ?? '';
              const rawUrl =
                'https://whoami-test-group.gina-park.site/api/user/friends/?type=all';
              const rawRes = await fetch(rawUrl, {
                method: 'GET',
                headers: {
                  'X-CSRFToken': csrf,
                  Cookie: `csrftoken=${csrf}; access_token=${accessToken}`,
                  'Content-Type': 'application/json',
                },
              });
              const rawText = await rawRes.text();
              console.log('[WidgetSync] Raw fetch /user/friends/:', {
                status: rawRes.status,
                bodyPreview: rawText.slice(0, 300),
              });
            } catch (rawErr) {
              console.warn('[WidgetSync] Raw fetch failed:', rawErr);
            }

            let friendsRaw: any;
            try {
              friendsRaw = await ApiService.API.get('user/friends/', {
                params: { type: 'all' },
              });
            } catch (e: any) {
              console.warn('[WidgetSync] /user/friends/ threw:', {
                message: e?.message,
                status: e?.response?.status,
                data: e?.response?.data,
              });
              throw e;
            }
            console.log(
              '[WidgetSync] /user/friends/ preview:',
              JSON.stringify(friendsRaw).slice(0, 400),
            );
            type FriendItem = {
              id: number;
              username: string;
              profile_image: string | null;
              current_user_read: boolean;
              unread_post_cnt: number;
              latest_unread_post: {
                id: number;
                type: string;
                content: string;
                images: string[];
              } | null;
              last_updated_field:
                | 'mood'
                | 'social_battery'
                | 'song'
                | 'thought'
                | null;
              mood: string[] | string | null;
              social_battery: string | null;
              thought: string | null;
              track_id: string | null;
            };
            const allFriends: FriendItem[] = Array.isArray(friendsRaw)
              ? friendsRaw
              : (friendsRaw as any)?.results ?? [];

            const rawObj = (friendsRaw as any) ?? {};
            console.log('[WidgetSync] Friend list raw shape:', {
              isArray: Array.isArray(friendsRaw),
              topLevelKeys:
                typeof friendsRaw === 'object' && friendsRaw
                  ? Object.keys(rawObj).slice(0, 10)
                  : [],
              count: rawObj.count,
              resultsLen: Array.isArray(rawObj.results)
                ? rawObj.results.length
                : 'not-array',
              next: rawObj.next,
              firstFriendKeys: allFriends[0]
                ? Object.keys(allFriends[0]).slice(0, 30)
                : [],
              firstFriendSample: allFriends[0]
                ? {
                    username: allFriends[0].username,
                    current_user_read: allFriends[0].current_user_read,
                    unread_post_cnt: allFriends[0].unread_post_cnt,
                    has_latest_unread_post: !!allFriends[0].latest_unread_post,
                    last_updated_field: allFriends[0].last_updated_field,
                  }
                : null,
            });

            const hasPostUpdate = (f: FriendItem) =>
              (f.unread_post_cnt ?? 0) > 0 || !!f.latest_unread_post;
            const hasCheckinUpdate = (f: FriendItem) =>
              f.current_user_read === false && !!f.last_updated_field;

            const candidates = allFriends.filter(
              (f) => hasPostUpdate(f) || hasCheckinUpdate(f),
            );
            console.log('[WidgetSync] Friend update candidates:', {
              total: allFriends.length,
              candidates: candidates.length,
            });
            if (candidates.length === 0) {
              console.warn(
                '[WidgetSync] No friends with updates — clearing Friend Update Widget',
              );
              await clearFriendUpdateFromWidget();
            } else {
              const picked =
                candidates[Math.floor(Math.random() * candidates.length)];
              const preferPost = hasPostUpdate(picked);
              console.log('[WidgetSync] Picked friend:', {
                username: picked.username,
                kind: preferPost ? 'post' : 'checkin',
                lastUpdatedField: picked.last_updated_field,
              });

              let payload: FriendUpdatePayload | null = null;
              let contentImageBase64 = '';

              if (preferPost && picked.latest_unread_post) {
                const post = picked.latest_unread_post;
                const hasImage = (post.images?.length ?? 0) > 0;
                if (hasImage) {
                  contentImageBase64 = await fetchImageAsBase64(post.images[0]);
                }
                payload = {
                  kind: 'post',
                  friend: { username: picked.username },
                  post: {
                    id: post.id,
                    content: post.content ?? '',
                    has_image: hasImage,
                  },
                };
              } else if (picked.last_updated_field) {
                const field = picked.last_updated_field;
                if (field === 'mood') {
                  const mood = normalizeMoodForWidget(picked.mood);
                  if (mood) {
                    payload = {
                      kind: 'checkin',
                      friend: { username: picked.username },
                      checkin: { variation: 'mood', mood },
                    };
                  }
                } else if (field === 'social_battery') {
                  if (picked.social_battery) {
                    payload = {
                      kind: 'checkin',
                      friend: { username: picked.username },
                      checkin: {
                        variation: 'social_battery',
                        social_battery: picked.social_battery,
                      },
                    };
                  }
                } else if (field === 'thought') {
                  if (picked.thought) {
                    payload = {
                      kind: 'checkin',
                      friend: { username: picked.username },
                      checkin: {
                        variation: 'thought',
                        description: picked.thought,
                      },
                    };
                  }
                } else if (field === 'song' && picked.track_id) {
                  const albumUrl = await fetchSpotifyAlbumImageUrl(
                    picked.track_id,
                  );
                  if (albumUrl) {
                    contentImageBase64 = await fetchImageAsBase64(albumUrl);
                  }
                  payload = {
                    kind: 'checkin',
                    friend: { username: picked.username },
                    checkin: {
                      variation: 'album',
                      track_id: picked.track_id,
                    },
                  };
                }
              }

              if (payload) {
                if (!isSyncStillValid()) {
                  console.log(
                    '[WidgetSync] Aborting stale sync before friend update write',
                  );
                  return;
                }
                const profileImageBase64 = await fetchImageAsBase64(
                  picked.profile_image,
                );
                await syncFriendUpdateToWidget(
                  payload,
                  profileImageBase64,
                  contentImageBase64,
                );
                if (!isSyncStillValid()) {
                  console.log(
                    '[WidgetSync] Aborting stale sync after friend update write',
                  );
                  return;
                }
              } else {
                console.warn(
                  '[WidgetSync] Picked friend had no renderable update — clearing widget',
                );
                await clearFriendUpdateFromWidget();
              }
            }
          } catch (fpErr) {
            console.warn('[WidgetSync] Friend update sync failed:', fpErr);
          }

          if (!isSyncStillValid()) {
            console.log(
              '[WidgetSync] Aborting stale sync before final refresh',
            );
            return;
          }
          await triggerWidgetRefresh();
          console.log('[WidgetSync] triggerWidgetRefresh completed');
        } catch (err) {
          console.warn('[WidgetSync] runWidgetSync failed:', err);
          await triggerWidgetRefresh();
        }
      })();
    },
    [tokens.access_token, tokens.csrftoken],
  );

  // Run widget sync once when tokens first become available (cold start). The ref is
  // reset on logout (tokens → empty) so the next login — including a different
  // account in the same session — gets a fresh sync that pushes the new user's
  // tokens/check-in to the widget instead of leaving the previous user's data.
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!tokens.access_token || !tokens.csrftoken) {
      initialSyncDoneRef.current = false;
      return;
    }
    if (initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    console.log(
      '[WidgetSync] Initial token load → triggering runWidgetSync(foreground)',
    );
    runWidgetSync('foreground');
  }, [tokens.access_token, tokens.csrftoken, runWidgetSync]);

  useAppStateEffect(
    (state) => {
      console.log('[WidgetSync] App state effect fired, state =', state, {
        hasAccessToken: !!tokens.access_token,
        hasCsrfToken: !!tokens.csrftoken,
      });
      if (state === 'inactive' && tokens.access_token && tokens.csrftoken) {
        console.log(
          '[WidgetSync] State=inactive → triggering runWidgetSync(background)',
        );
        runWidgetSync('background');
      }
      if (state === 'active' && tokens.access_token && tokens.csrftoken) {
        // Delay foreground widget sync so it doesn't race the WebView for
        // network/main-thread resources right when the user returns to the app.
        // Widget shows the last cached check-in immediately; this just defers
        // the network-heavy profile/discover/friends fetches.
        console.log(
          '[WidgetSync] State=active → scheduling delayed runWidgetSync(foreground)',
        );
        setTimeout(() => {
          if (!tokens.access_token || !tokens.csrftoken) return;
          console.log('[WidgetSync] Delayed foreground sync firing now');
          runWidgetSync('foreground');
        }, 1500);
        const logWidgetDiagnostics = () => {
          // getWidgetDiagnostics already logs the App Group state internally
          getWidgetDiagnostics().catch(() => {
            console.log('[WidgetSync] Widget diagnostics: failed to read');
          });
        };
        logWidgetDiagnostics();
        setTimeout(logWidgetDiagnostics, 1200);
      }
    },
    [tokens.access_token, tokens.csrftoken, runWidgetSync],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar />
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

type AppScreenProps = NativeStackScreenProps<ScreenRouteParamList, 'AppScreen'>;

export type AppScreenRoute = {
  AppScreen: {
    url: string | null;
  };
};

export default AppScreen;
