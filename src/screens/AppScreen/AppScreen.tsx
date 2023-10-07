import React, { useCallback, useLayoutEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import {
  useAppStateEffect,
  useAsyncEffect,
  usePushNotification,
  useWebView,
} from '@hooks';
import { FirebaseNotification, LocalNotification } from '@libs';
import { checkCookie } from '@tools';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/home' } = route.params;
  const WEBVIEW_URL = WEBVIEW_CONSTS.WEB_VIEW_URL.PROD + url;

  const { ref, onMessage, postMessage } = useWebView();
  const { updateFcmToken } = usePushNotification();

  useLayoutEffect(() => {
    StatusBar.setBarStyle('dark-content', true);

    // initialize LocalNotification
    LocalNotification.initialize(ref);
  }, []);

  // 푸시 권한 허용 변경 후 다시 앱으로 돌아왔을 때
  useAppStateEffect(
    useCallback(async (state) => {
      if (state === 'active' || state === 'unknown') {
        FirebaseNotification.getPermissionEnabled().then((enabled) => {
          postMessage('SET_NOTI_PERMISSION', { value: enabled });
          updateFcmToken(enabled);
        });
      }
    }, []),
    [],
  );

  useAsyncEffect(async () => {
    await checkCookie(WEBVIEW_URL);
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
        allowsBackForwardNavigationGestures
        decelerationRate="normal"
        javaScriptEnabled
        injectedJavaScript={WEBVIEW_CONSTS.WEB_VIEW_DEBUGGING_SCRIPT}
        originWhitelist={['*']}
        scalesPageToFit={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        incognito={true}
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

export default React.memo(AppScreen);
