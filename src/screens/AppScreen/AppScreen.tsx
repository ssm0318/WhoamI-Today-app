import React, { useCallback, useLayoutEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useAppStateEffect, useWebView } from '@hooks';
import { FirebaseNotification } from '@libs';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/home' } = route.params;

  const { ref, onMessage, postMessage } = useWebView();

  useLayoutEffect(() => {
    StatusBar.setBarStyle('dark-content', true);
  }, []);

  useAppStateEffect(
    useCallback(
      async (state) => {
        if (state === 'active' || state === 'unknown') {
          FirebaseNotification.getPermissionEnabled().then((enabled) => {
            postMessage('SET_NOTI_PERMISSION', { value: enabled });
          });
        }
      },
      [postMessage],
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <WebView
        ref={ref}
        onMessage={onMessage}
        source={{
          uri: WEBVIEW_CONSTS.WEB_VIEW_URL.DEV + url,
        }}
        decelerationRate="normal"
        javaScriptEnabled
        injectedJavaScript={WEBVIEW_CONSTS.WEB_VIEW_DEBUGGING_SCRIPT}
        originWhitelist={['*']}
        scalesPageToFit={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
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
