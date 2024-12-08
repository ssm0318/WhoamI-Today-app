import { useNavigationService } from '@hooks';
import {
  CookieStorage,
  parseCookie,
  redirectSetting,
  saveCookie,
} from '@tools';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { WebViewMessageEvent, WebView } from 'react-native-webview';
import { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { ScreenRouteParamList } from '@screens';

const useWebView = () => {
  const [loadProgress, setLoadProgress] = useState(0);
  const ref = useRef<WebView>(null);
  const navigation = useNavigationService();
  const [tokens, setTokens] = useState({ csrftoken: '', access_token: '' });
  const { getCookie } = CookieStorage;

  const postMessage = useCallback((key: string, data: any) => {
    ref.current?.postMessage(JSON.stringify({ key, data }));
  }, []);

  const injectCookieScript = useCallback(
    (csrftoken: string, access_token: string) => {
      return `
        document.cookie = 'csrftoken=${csrftoken};path=/';
        document.cookie = 'access_token=${access_token};path=/';
      `;
    },
    [],
  );

  useEffect(() => {
    const fetchTokens = async () => {
      const { access_token, csrftoken } = await getCookie();
      setTokens({ access_token, csrftoken });
    };

    fetchTokens();
  }, []);

  /**
   * 웹뷰에서 오는 요청 처리
   */
  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (!('actionType' in data)) return;

    switch (data.actionType) {
      case 'CONSOLE':
        console.log('[WEBVIEW CONSOLE]', data.data);
        return;
      case 'OPEN_BROWSER':
        //TODO(Gina): 나중에 가능하다면 openBrowserAsync 사용해보기
        await Linking.openURL(data.url);
        return;
      case 'NAVIGATE': {
        if (!data.screenName) return;
        return navigation.push(data.screenName as keyof ScreenRouteParamList, {
          ...data.params,
        });
      }
      case 'OPEN_SETTING':
        return redirectSetting();
      case 'SET_COOKIE': {
        const parsedCookie = parseCookie(data.value);
        setTokens(parsedCookie);
        return saveCookie(parsedCookie);
      }
      case 'LOGOUT': {
        await CookieStorage.removeCookie();
        setTokens({ csrftoken: '', access_token: '' });

        // WebView 쿠키 제거를 위한 스크립트 실행
        ref.current?.injectJavaScript(`
            document.cookie.split(';').forEach(function(c) { 
              document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); 
            });
            window.location.reload();
          `);

        return;
      }
      default:
        return;
    }
  }, []);

  const onLoadProgress = useCallback((e: WebViewProgressEvent) => {
    setLoadProgress(e.nativeEvent.progress);
  }, []);

  return {
    ref,
    loadProgress,
    onMessage,
    onLoadProgress,
    postMessage,
    injectCookieScript,
    tokens,
  };
};

export default useWebView;
