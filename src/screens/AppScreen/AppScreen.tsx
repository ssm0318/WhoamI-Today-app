import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
} from '@hooks';
import { CookieStorage, FcmTokenStorage } from '@tools';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/' } = route.params;
  const WEBVIEW_URL = APP_CONSTS.WEB_VIEW_URL + url;
  console.log(24, WEBVIEW_URL);
  const [tokens, setTokens] = useState({ csrftoken: '', access_token: '' });
  const [refreshing, setRefreshing] = useState(false);
  const { ref, onMessage, postMessage } = useWebView();
  const { getCookie } = CookieStorage;

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
        // TODO: 만약 서버 DB에 deprecated된 토큰이 많이 생겨 문제 발생시 이 부분 수정 필요
        // if (pushToken) return;
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

  useEffect(() => {
    const fetchTokens = async () => {
      const { access_token, csrftoken } = await getCookie();
      setTokens({ access_token, csrftoken });
    };

    fetchTokens();
  }, []);

  const triggerRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  React.useEffect(() => {
    if (refreshing) {
      triggerRefresh();
    }
  }, [refreshing]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <ScrollView
        contentContainerStyle={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              triggerRefresh();
            }}
          />
        }
      >
        <WebView
          ref={ref}
          onMessage={onMessage}
          source={{
            uri: WEBVIEW_URL,
          }}
          injectedJavaScriptBeforeContentLoaded={
            "document.cookie='csrftoken=" +
            tokens.csrftoken +
            "';document.cookie='access_token=" +
            tokens.access_token +
            "';"
          }
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
          cacheEnabled={false}
          cacheMode={'LOAD_NO_CACHE'}
          incognito={true}
        />
      </ScrollView>
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
