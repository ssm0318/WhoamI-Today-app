import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEBVIEW_CONSTS } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenRouteParamList } from '@screens';
import { useWebView } from '@hooks';

const AppScreen: React.FC<AppScreenProps> = ({ route }) => {
  const { url = '/home' } = route.params;

  const { ref, onMessage, postMessage } = useWebView();

  useEffect(() => {
    if (!url) {
      return;
    }
    postMessage('REDIRECT', url);
  }, [postMessage, url]);

  return (
    <SafeAreaView style={styles.container}>
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
