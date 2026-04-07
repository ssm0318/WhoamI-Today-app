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
import ApiService from '../../apis/API';
import {
  getWidgetDiagnostics,
  syncSpotifyCredentialsToWidget,
  syncMyCheckInToWidget,
  triggerWidgetRefresh,
} from '../../native/WidgetDataModule';
import {
  getCachedCheckInForWidget,
  setCachedCheckInForWidget,
} from '../../utils/widgetCheckInCache';
import { setWidgetDataStale } from '../../utils/widgetDataStale';
import { fetchSpotifyAlbumImageUrl } from '../../utils/spotifyAlbumImage';

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

  // Reload WebView when version changes
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

  useEffect(() => {
    const shouldReload = tokens.access_token && tokens.csrftoken && ref.current;
    if (shouldReload) {
      console.log('[AppScreen] Reloading WebView due to changes:', {
        access_token: !!tokens.access_token,
        csrftoken: !!tokens.csrftoken,
      });
      ref.current.reload();
    }
  }, [tokens.access_token, tokens.csrftoken]);

  // Reload WebView only when app is completely terminated and restarted
  useEffect(() => {
    if (tokens.access_token && tokens.csrftoken) {
      console.log('[AppScreen] App cold started, reloading WebView');
      ref.current?.reload();
    }
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
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
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
    if (!tokens.access_token || !tokens.csrftoken) return;
    setWidgetDataStale(false);

    const cachedCheckIn = getCachedCheckInForWidget();
    if (cachedCheckIn) {
      syncMyCheckInToWidget(cachedCheckIn).then(() => triggerWidgetRefresh());
    }

    (async () => {
      try {
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
        const songs = songResponse as {
          track_id: string;
          is_active: boolean;
        }[];
        const trackId =
          (Array.isArray(songs) ? songs.find((s) => s.is_active) : null)
            ?.track_id ?? '';
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
      } catch (err) {
        console.warn('[AppScreen] Widget sync failed:', err);
        await triggerWidgetRefresh();
      }
    })();
  }, [tokens.access_token, tokens.csrftoken]);

  useAppStateEffect(
    (state) => {
      if (state === 'inactive' && tokens.access_token && tokens.csrftoken) {
        runWidgetSync();
      }
      if (state === 'active' && tokens.access_token && tokens.csrftoken) {
        triggerWidgetRefresh();
        const logWidgetDiagnostics = () => {
          getWidgetDiagnostics()
            .then((d) => {
              console.log(
                '[AppScreen] Widget diagnostics:',
                d
                  ? `lastSeenMood=${d.lastSeenMood} lastGetTimelineAt=${d.lastGetTimelineAt}`
                  : 'unavailable',
              );
            })
            .catch(() => {
              console.log('[AppScreen] Widget diagnostics: failed to read');
            });
        };
        logWidgetDiagnostics();
        setTimeout(logWidgetDiagnostics, 1200);
        Promise.all([
          ApiService.API.get('user/me/profile') as Promise<unknown>,
          ApiService.API.get('check_in/song/').catch(
            () => [],
          ) as Promise<unknown>,
        ])
          .then(async ([profileResponse, songResponse]) => {
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
            const songs = songResponse as {
              track_id: string;
              is_active: boolean;
            }[];
            const trackId =
              (Array.isArray(songs) ? songs.find((s) => s.is_active) : null)
                ?.track_id ?? '';
            const checkIn = res?.check_in;
            if (checkIn) {
              let albumImageUrl: string | null = null;
              if (trackId.trim()) {
                albumImageUrl = await fetchSpotifyAlbumImageUrl(trackId);
              }
              setCachedCheckInForWidget({
                id: checkIn.id,
                isActive: checkIn.is_active,
                createdAt: checkIn.created_at,
                mood: checkIn.mood ?? '',
                socialBattery: checkIn.social_battery ?? null,
                description: checkIn.description ?? '',
                trackId,
                albumImageUrl,
              });
            }
          })
          .catch(() => undefined);
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
