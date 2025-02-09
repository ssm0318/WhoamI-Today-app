import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
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
import { FcmTokenStorage, userVersionStorage } from '@tools';
import { userApis } from '@apis';
import { UserType } from '@types';
import { VersionType } from 'src/types/user.type';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/' } = route.params;
  const WEBVIEW_URL = APP_CONSTS.WEB_VIEW_URL + url;
  const { ref, onMessage, postMessage, injectCookieScript, tokens } =
    useWebView();
  const [isCanGoBack, setIsCanGoBack] = useState(false);
  const [userVersion, setUserVersion] = useState<string | null>(null);

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

  useAsyncEffect(async () => {
    await requestPermissionIfNot();
  }, []);

  useAsyncEffect(async () => {
    // Initial version check
    const version = await userVersionStorage.get();
    console.log('[AppScreen] Stored user version:', version);
    setUserVersion(version);

    // Get latest version from API
    const meResponse = await userApis.getMe();
    const versionChanged = await userVersionStorage.checkAndUpdate(
      meResponse.current_ver || UserType.VersionType.DEFAULT,
    );

    if (versionChanged) {
      console.log('[AppScreen] Version changed, updating state...');
      setUserVersion(meResponse.current_ver || VersionType.DEFAULT);
    }
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
    // Force reload when tokens or user version changes
    if (ref.current) {
      console.log('[AppScreen] Reloading WebView due to changes:', {
        access_token: tokens.access_token ? 'exists' : 'none',
        csrftoken: tokens.csrftoken ? 'exists' : 'none',
        userVersion,
      });
      ref.current.reload();
    }
  }, [tokens.access_token, tokens.csrftoken, userVersion]);

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
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        onLoadEnd={() => {
          syncPushNotiPermission();
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
