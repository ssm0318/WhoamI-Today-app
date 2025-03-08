import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  View,
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
import { FcmTokenStorage } from '@tools';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/' } = route.params;
  const WEBVIEW_URL = APP_CONSTS.WEB_VIEW_URL + url;
  const { ref, onMessage, postMessage, injectCookieScript, tokens } =
    useWebView();
  const [isCanGoBack, setIsCanGoBack] = useState(false);

  const [isWebViewLoaded, setWebViewLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isRunningRef = useRef(false);
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

  const handlePushNotification = useCallback(async () => {
    console.log('[AppScreen] handlePushNotification');
    try {
      if (isRunningRef.current) {
        console.log('[AppScreen] Push notification check already in progress');
        return;
      }
      isRunningRef.current = true;

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

      const { fcmToken: storedToken } = await FcmTokenStorage.getToken();
      console.log('[AppScreen] Push notification status:', {
        enabled,
        storedToken,
        hasAccessToken: !!tokens.access_token,
      });

      if (enabled) {
        await registerOrUpdatePushToken(true);
      } else {
        await registerOrUpdatePushToken(false);
      }
    } catch (error) {
      console.error('[AppScreen] Error in handlePushNotification:', error);
    } finally {
      isRunningRef.current = false;
    }
  }, [hasPermission, postMessage, registerOrUpdatePushToken, tokens]);

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
    console.log('⭐️ tokens:', tokens);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <WebView
        ref={ref}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'navigationStateChange') {
            setIsCanGoBack(event.nativeEvent.canGoBack);
            return;
          }
          onMessage(event);
        }}
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
        decelerationRate="normal"
        javaScriptEnabled
        injectedJavaScript={WEBVIEW_CONSTS.WEB_VIEW_DEBUGGING_SCRIPT}
        originWhitelist={['*']}
        scalesPageToFit={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        onLoadStart={() => setIsLoading(true)}
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
        }}
        onRenderProcessGone={(syntheticEvent) => {
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
