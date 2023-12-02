import React, { useCallback } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import {
  useAppStateActiveEffect,
  useAsyncEffect,
  useFirebaseMessage,
  useWebView,
} from '@hooks';
import { FcmTokenStorage } from '@tools';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/friends' } = route.params;
  const WEBVIEW_URL = WEBVIEW_CONSTS.WEB_VIEW_URL + url;

  const { ref, onMessage, postMessage } = useWebView();
  const {
    updatePushToken,
    hasPermission,
    deletePushToken,
    requestPermissionIfNot,
  } = useFirebaseMessage();

  const syncPushNotiPermission = useCallback(async () => {
    hasPermission().then(async (enabled) => {
      postMessage('SET_NOTI_PERMISSION', { value: enabled });
      const { fcmToken: pushToken } = await FcmTokenStorage.getToken();
      if (enabled) {
        // 중복 호출을 막기 위해 storage에 pushToken이 없을 때만 호출
        if (pushToken) return;
        return await updatePushToken();
      } else {
        return await deletePushToken();
      }
    });
  }, []);

  // 푸시 권한 허용 변경 후 다시 앱으로 돌아왔을 때
  useAppStateActiveEffect(syncPushNotiPermission);
  useAsyncEffect(syncPushNotiPermission, []);

  useAsyncEffect(async () => {
    await requestPermissionIfNot();
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
        domStorageEnabled
        onLoad={async () => {
          // WebView 컴포넌트가 완전히 load 된 후에 동작
          syncPushNotiPermission();
        }}
        onContentProcessDidTerminate={() => {
          ref.current?.reload();
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
