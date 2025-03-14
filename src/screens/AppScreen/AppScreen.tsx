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
  useSession,
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

  // 세션 관리를 위한 훅 호출
  useSession();

  // 버전 체크 및 업데이트를 자동으로 수행
  // 버전 변경 여부를 감지
  const versionChanged = useVersionCheckUpdate(tokens);

  // 버전이 변경되었을 때 WebView 리로드
  useEffect(() => {
    if (versionChanged && ref.current) {
      console.log('[AppScreen] Version changed, reloading WebView');
      ref.current.reload();
    }
  }, [versionChanged]);

  // 푸시 권한 허용 변경 후 다시 앱으로 돌아왔을 때만 체크하도록 수정
  const handlePushNotification = async () => {
    try {
      const enabled = await hasPermission();
      console.log('[AppScreen] Push notification status:', {
        enabled,
      });
      postMessage('SET_NOTI_PERMISSION', { value: enabled });

      if (!tokens.access_token) {
        console.log(
          '[AppScreen] No access token available, skipping push token registration',
        );
        return;
      }

      if (enabled) {
        await registerOrUpdatePushToken(true);
      } else {
        await registerOrUpdatePushToken(false);
      }
    } catch (error) {
      console.error('[AppScreen] Error in handlePushNotification:', error);
    }
  };

  // 푸시 권한 허용 변경 후 다시 앱으로 돌아왔을 때만 체크하도록 수정
  useAppStateActiveEffect(handlePushNotification);

  // 초기 권한 요청만 하고 토큰 등록은 하지 않음
  useAsyncEffect(async () => {
    await requestPermissionIfNot();
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
      handlePushNotification();
    }
  }, [tokens.access_token, tokens.csrftoken]);

  const onPressHardwareBackButton = () => {
    if (ref.current && isCanGoBack) {
      ref.current.goBack();
      return true;
    } else {
      return false;
    }
  };

  const sendKeyboardHeightToWebView = (height: number) => {
    if (ref.current) {
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

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      (event) => {
        const height = event.endCoordinates.height;
        setKeyboardHeight(height);
        sendKeyboardHeightToWebView(height);
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
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
        domStorageEnabled
        /* 키보드 관련 설정 */
        scrollEnabled={false}
        // Android에서 키보드가 WebView 내용을 가리지 않도록 설정
        keyboardDisplayRequiresUserAction={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        )}
        onLoadEnd={() => {
          setIsLoading(false);
          if (!isWebViewLoaded) {
            setWebViewLoaded(true);
            handlePushNotification();
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
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
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
