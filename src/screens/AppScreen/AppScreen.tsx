import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
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
  useVersionInfo,
} from '@hooks';
import { FcmTokenStorage, requestCameraPermission } from '@tools';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/' } = route.params;
  const WEBVIEW_URL = APP_CONSTS.WEB_VIEW_URL + url;
  const { ref, onMessage, postMessage, injectCookieScript, tokens } =
    useWebView();
  const [isCanGoBack, setIsCanGoBack] = useState(false);
  const { userVersion, checkAndUpdateVersion } = useVersionInfo();
  const [isWebViewLoaded, setWebViewLoaded] = useState(false);

  const { registerOrUpdatePushToken, hasPermission, requestPermissionIfNot } =
    useFirebaseMessage();

  const syncPushNotiPermission = useCallback(async () => {
    hasPermission().then(async (enabled) => {
      postMessage('SET_NOTI_PERMISSION', { value: enabled });
      const { fcmToken: pushToken } = await FcmTokenStorage.getToken();
      if (enabled) {
        // 중복 호출을 막기 위해 storage에 pushToken이 없을 때만 호출
        // TODO: 만약 서버 DB에 deprecated된 토큰이 많이 생겨 문제 발생시 이 부분 수정 필요
        // if (pushToken) return;
        return await registerOrUpdatePushToken(true);
      } else {
        return await registerOrUpdatePushToken(false);
      }
    });
  }, []);

  const onPressHardwareBackButton = () => {
    if (ref.current && isCanGoBack) {
      ref.current.goBack();
      return true;
    } else {
      return false;
    }
  };

  // 푸시 권한 허용 변경 후 다시 앱으로 돌아왔을 때
  useAppStateActiveEffect(syncPushNotiPermission);
  useAsyncEffect(syncPushNotiPermission, []);

  // 푸시 권한 허용 요청
  useAsyncEffect(async () => {
    await requestPermissionIfNot();
  }, []);

  // 버전 체크 및 업데이트
  useEffect(() => {
    const initializeVersion = async () => {
      try {
        await checkAndUpdateVersion();
      } catch (error) {
        console.error('[AppScreen] Error in version check flow:', error);
      }
    };

    initializeVersion();
  }, []);

  // 앱이 활성화될 때마다 버전 체크
  useAppStateActiveEffect(() => {
    const checkVersionOnActive = async () => {
      try {
        await checkAndUpdateVersion();
      } catch (error) {
        console.error('[AppScreen] Error in version check on active:', error);
      }
    };

    checkVersionOnActive();
  });

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
    const shouldReload =
      tokens.access_token && tokens.csrftoken && userVersion && ref.current;
    if (shouldReload) {
      console.log('[AppScreen] Reloading WebView due to changes:', {
        access_token: !!tokens.access_token,
        csrftoken: !!tokens.csrftoken,
        userVersion,
      });
      ref.current.reload();
    }
  }, [tokens.access_token, tokens.csrftoken, userVersion]);

  useAsyncEffect(async () => {
    // 안드로이드의 경우 처음 로드 이후 로그인 성공시 카메라 권한 최초 요청
    // 로그인 성공 여부는 쿠키 존재 여부로 판단
    const isLoggedIn = !!tokens.access_token && !!tokens.csrftoken;
    if (Platform.OS === 'android' && isLoggedIn) {
      await requestCameraPermission();
    }
  }, [tokens]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <WebView
        ref={ref}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'navigationStateChange') {
            // Navigation state updated, can check state.canGoBack, etc.
            setIsCanGoBack(event.nativeEvent.canGoBack);
            return;
          }
          onMessage(event);
        }}
        source={{
          uri: WEBVIEW_URL,
        }}
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
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        onLoadEnd={() => {
          if (!isWebViewLoaded) {
            setWebViewLoaded(true);
            syncPushNotiPermission();
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

type AppScreenProps = NativeStackScreenProps<ScreenRouteParamList, 'AppScreen'>;

export type AppScreenRoute = {
  AppScreen: {
    url: string | null;
  };
};

export default AppScreen;
