import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  NativeModules,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
  useAnalytics,
  useAppStateEffect,
} from '@hooks';
import RNFetchBlob from 'rn-fetch-blob';
import ApiService from '../../apis/API';
import {
  getWidgetDiagnostics,
  syncSpotifyCredentialsToWidget,
  syncMyCheckInToWidget,
  syncSharedPlaylistTrackToWidget,
  syncFriendPostToWidget,
  clearFriendPostFromWidget,
  syncTokensToWidget,
  triggerWidgetRefresh,
} from '../../native/WidgetDataModule';
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
  const initialUri = isDeepLinkPath ? BASE_URL : BASE_URL + url;
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
  const { registerOrUpdatePushToken, hasPermission, requestPermissionIfNot } =
    useFirebaseMessage();

  // GA tracking
  useAnalytics(tokens);

  // Automatically perform version check and update
  // Detect version changes
  const versionChanged = useVersionCheckUpdate(tokens);

  // Reload on version change (rare, after the initial load)
  useEffect(() => {
    if (versionChanged && ref.current) {
      console.log('[AppScreen] Version changed, reloading WebView');
      ref.current.reload();
    }
  }, [versionChanged]);

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
      BackHandler.addEventListener('hardwareBackPress', handler);
      return () =>
        BackHandler.removeEventListener('hardwareBackPress', handler);
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
        key={isDeepLinkPath ? `${BASE_URL}-redirect-${url}` : initialUri}
        ref={ref}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={onNavigationStateChange}
        source={{
          uri: initialUri,
        }}
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: '#FFFFFF' }}
        injectedJavaScriptBeforeContentLoaded={
          injectCookieScript(tokens.csrftoken, tokens.access_token) +
          (isDeepLinkPath
            ? `(function(){var b=${JSON.stringify(
                BASE_URL.replace(/\/+$/, ''),
              )},p=${JSON.stringify(
                url,
              )};if(p&&p!=="/"&&p!==""){var pathPart=p.replace(/^\\/+/, "");if(location.pathname==="/"||location.pathname===""){location.replace(b+(pathPart?"/"+pathPart:""));}}})();`
            : '')
        }
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
        cacheEnabled={false}
        domStorageEnabled
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

  // Sync latest check-in to widget when leaving app. Run on 'inactive' so reload is more likely
  // to be honored. First push cached check-in and reload immediately (no network); then fetch and sync.
  const runWidgetSync = useCallback(() => {
    console.log('[WidgetSync] runWidgetSync called', {
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
      syncMyCheckInToWidget(cachedCheckIn).then(() => triggerWidgetRefresh());
    } else {
      console.log('[WidgetSync] No cached check-in to push immediately');
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
            mood: checkIn.mood ?? '',
            socialBattery: checkIn.social_battery ?? null,
            description: checkIn.description ?? '',
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
          const discoverResponse = (await ApiService.API.get('user/discover/', {
            params: { page: 1 },
          })) as {
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
            console.log('[WidgetSync] Picked random shared track:', {
              idx: randomIdx,
              id: picked.id,
              trackId: picked.track_id,
              sharerUsername: picked.user.username,
              hasProfileImage: !!picked.user.profile_image,
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
              fetchImageAsBase64(picked.user.profile_image),
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
                sharerProfileImageUrl: picked.user.profile_image ?? null,
              },
              albumImageBase64,
              avatarImageBase64,
            );
          } else {
            console.warn(
              '[WidgetSync] No music_tracks in discover feed — AlbumCoverWidget will show placeholder',
            );
          }
        } catch (spErr) {
          console.warn('[WidgetSync] Shared playlist sync failed:', spErr);
        }

        // ── Friend post sync (independent from myCheckIn and shared playlist) ──
        // Fetches /user/friends/ → picks a random friend with unread posts → uses
        // latest_unread_post for content/images → syncs to PhotoWidget.
        try {
          console.log('[WidgetSync] Fetching friend list from /user/friends/');
          const friendsRaw = await ApiService.API.get('user/friends/', {
            params: { type: 'all' },
          });
          // Response may be paginated {results:[...]} or plain array
          type FriendItem = {
            id: number;
            username: string;
            profile_image: string | null;
            unread_post_cnt: number;
            latest_unread_post: {
              id: number;
              type: string;
              content: string;
              images: string[];
            } | null;
          };
          const allFriends: FriendItem[] = Array.isArray(friendsRaw)
            ? friendsRaw
            : (friendsRaw as any)?.results ?? [];
          console.log('[WidgetSync] Friend list response:', {
            isArray: Array.isArray(friendsRaw),
            friendCount: allFriends.length,
            sample: allFriends[0]
              ? {
                  username: allFriends[0].username,
                  unread_post_cnt: allFriends[0].unread_post_cnt,
                  hasLatestPost: !!allFriends[0].latest_unread_post,
                }
              : null,
          });
          const friendsWithPosts = allFriends.filter(
            (f) => f.unread_post_cnt > 0 && f.latest_unread_post,
          );
          console.log('[WidgetSync] Friends with unread posts:', {
            total: allFriends.length,
            withPosts: friendsWithPosts.length,
          });
          if (friendsWithPosts.length > 0) {
            const randomIdx = Math.floor(
              Math.random() * friendsWithPosts.length,
            );
            const pickedFriend = friendsWithPosts[randomIdx];
            const post = pickedFriend.latest_unread_post!;
            console.log('[WidgetSync] Picked friend with unread post:', {
              idx: randomIdx,
              friendUsername: pickedFriend.username,
              profileImage: pickedFriend.profile_image,
              postId: post.id,
              postType: post.type,
              contentLen: post.content?.length ?? 0,
              imagesCount: post.images?.length ?? 0,
            });
            const [authorImageBase64, postImageBase64] = await Promise.all([
              fetchImageAsBase64(pickedFriend.profile_image),
              post.images && post.images.length > 0
                ? fetchImageAsBase64(post.images[0])
                : Promise.resolve(''),
            ]);
            console.log('[WidgetSync] Friend post images fetched', {
              authorImageBase64Len: authorImageBase64.length,
              postImageBase64Len: postImageBase64.length,
            });
            await syncFriendPostToWidget(
              {
                id: post.id,
                type: post.type,
                content: post.content,
                images: post.images,
                currentUserRead: false,
                authorUsername: pickedFriend.username,
              },
              authorImageBase64,
              postImageBase64,
            );
          } else {
            console.warn(
              '[WidgetSync] No friends with unread posts — clearing PhotoWidget',
            );
            await clearFriendPostFromWidget();
          }
        } catch (fpErr) {
          console.warn('[WidgetSync] Friend post sync failed:', fpErr);
        }

        await triggerWidgetRefresh();
        console.log('[WidgetSync] triggerWidgetRefresh completed');
      } catch (err) {
        console.warn('[WidgetSync] runWidgetSync failed:', err);
        await triggerWidgetRefresh();
      }
    })();
  }, [tokens.access_token, tokens.csrftoken]);

  // Run widget sync once when tokens first become available (cold start)
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!tokens.access_token || !tokens.csrftoken) return;
    if (initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    console.log('[WidgetSync] Initial token load → triggering runWidgetSync');
    runWidgetSync();
  }, [tokens.access_token, tokens.csrftoken, runWidgetSync]);

  useAppStateEffect(
    (state) => {
      console.log('[WidgetSync] App state effect fired, state =', state, {
        hasAccessToken: !!tokens.access_token,
        hasCsrfToken: !!tokens.csrftoken,
      });
      if (state === 'inactive' && tokens.access_token && tokens.csrftoken) {
        console.log('[WidgetSync] State=inactive → triggering runWidgetSync');
        runWidgetSync();
      }
      if (state === 'active' && tokens.access_token && tokens.csrftoken) {
        console.log('[WidgetSync] State=active → triggering runWidgetSync');
        runWidgetSync();
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
    <SafeAreaView style={styles.container}>
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
