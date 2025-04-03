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

  // GA 트래킹
  useAnalytics(tokens);

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

  // 초기 권한 요청만 하고 토큰 등록은 하지 않음
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

  // 앱이 완전히 종료되었다가 다시 실행될 때만 WebView 리로드
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

  // Android 전용 키보드 높이 WebView에 전달하는 함수
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

  // Android 전용 키보드 이벤트 리스너
  useEffect(() => {
    // iOS에서는 키보드 이벤트를 처리하지 않음
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

  // Android 전용 키보드 표시 시 WebView 패딩 조정
  useEffect(() => {
    // iOS에서는 키보드 관련 처리를 하지 않음
    if (Platform.OS !== 'android') return;

    const onShow = (e: { endCoordinates: { height: number } }) => {
      const kbHeight = e.endCoordinates.height;
      // 웹뷰에 JS 주입: body에 bottom 패딩 추가
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

  // KeyboardAvoidingView를 플랫폼에 따라 조건부 렌더링하는 함수
  const renderContent = () => {
    if (Platform.OS === 'android') {
      // Android에서는 KeyboardAvoidingView 사용
      return (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {renderWebView()}
        </KeyboardAvoidingView>
      );
    } else {
      // iOS에서는 KeyboardAvoidingView 없이 직접 WebView 렌더링
      return renderWebView();
    }
  };

  // WebView 렌더링 함수
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
        /* 키보드 관련 설정 - 플랫폼별 차이 적용 */
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

  // 앱 상태 변경 시 웹뷰에 전달
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
