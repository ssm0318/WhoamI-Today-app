import { useFirebaseMessage, useNavigationService } from '@hooks';
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
  const { registerOrUpdatePushToken } = useFirebaseMessage();

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

  // Add effect to log tokens whenever they change
  // useEffect(() => {
  //   console.log('[Token Update] csrftoken:', tokens.csrftoken);
  //   console.log('[Token Update] access_token:', tokens.access_token);
  // }, [tokens]);

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
        console.log('LOGOUT');

        // firebase 푸시 토큰 해제
        await registerOrUpdatePushToken(false);

        await CookieStorage.removeCookie();
        setTokens({ csrftoken: '', access_token: '' });

        // Improved WebView cookie and storage cleanup
        ref.current?.injectJavaScript(`
          (function() {
            // Clear cookies
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
              const cookie = cookies[i];
              const eqPos = cookie.indexOf('=');
              const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
              document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
              document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
            }
            
            // Clear storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear cache and reload
            if (window.caches) {
              caches.keys().then(function(names) {
                for (let name of names) caches.delete(name);
              });
            }
            
            // Force reload from server
            window.location.reload(true);
          })();
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
