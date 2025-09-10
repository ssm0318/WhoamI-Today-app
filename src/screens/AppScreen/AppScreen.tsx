import React, { useEffect, useState } from 'react';
import {
  BackHandler,
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
import * as Sentry from '@sentry/react-native';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/' } = route.params;
  const WEBVIEW_URL = APP_CONSTS.WEB_VIEW_URL + url;
  const {
    ref,
    onMessage,
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

  useEffect(() => {
    BackHandler.addEventListener(
      'hardwareBackPress',
      onPressHardwareBackButton,
    );
    return () => {
      BackHandler.removeEventListener(
        'hardwareBackPress',
        onPressHardwareBackButton,
      );
    };
  }, [isCanGoBack]);

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

  const onPressHardwareBackButton = () => {
    if (ref.current && isCanGoBack) {
      ref.current.goBack();
      return true;
    } else {
      return false;
    }
  };

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

  // WebView rendering function
  const renderWebView = () => {
    return (
      <WebView
        ref={ref}
        onMessage={onMessage}
        source={{
          uri: WEBVIEW_URL,
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
          Sentry.captureException(nativeEvent);
        }}
        onRenderProcessGone={(syntheticEvent) => {
          Sentry.captureException(syntheticEvent);
          console.warn('WebView crashed, reloading...');
          ref.current?.reload();
        }}
        onContentProcessDidTerminate={(syntheticEvent) => {
          Sentry.captureException(syntheticEvent);
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
