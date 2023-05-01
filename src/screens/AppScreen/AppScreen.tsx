import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useAppStateActiveEffect, useWebView } from '@hooks';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import NotiPermissionRequestButton from './components/NotiPermissionRequestButton/NotiPermissionRequestButton';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/home' } = route.params;

  const { ref, onMessage, postMessage } = useWebView();
  const [hasNotiPermission, setHasNotiPermission] = useState(false);
  const [isOnNotificationPage, setIsOnNotificationpage] = useState(false);

  const handleOnNavigationStateChange = (event: WebViewNavigation) => {
    return setIsOnNotificationpage(event.url.includes('/notifications'));
  };

  useEffect(() => {
    if (!url) return;
    postMessage('REDIRECT', url);
  }, [postMessage, url]);

  useAppStateActiveEffect(
    useCallback(async () => {
      const settings = await notifee.requestPermission();
      setHasNotiPermission(
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
      );
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={ref}
        onMessage={onMessage}
        source={{
          uri: WEBVIEW_CONSTS.WEB_VIEW_URL.PROD,
        }}
        decelerationRate="normal"
        javaScriptEnabled
        injectedJavaScript={WEBVIEW_CONSTS.WEB_VIEW_DEBUGGING_SCRIPT}
        originWhitelist={['*']}
        onNavigationStateChange={handleOnNavigationStateChange}
      />
      {isOnNotificationPage && !hasNotiPermission && (
        <NotiPermissionRequestButton />
      )}
    </SafeAreaView>
  );
};

type AppScreenProps = NativeStackScreenProps<ScreenRouteParamList, 'AppScreen'>;

export type AppScreenRoute = {
  AppScreen: {
    url: string | null;
  };
};

export default AppScreen;
