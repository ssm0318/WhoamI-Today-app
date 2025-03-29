import { useAnalytics, useFirebaseMessage, useNavigationService } from '@hooks';
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
import ImagePicker from 'react-native-image-crop-picker';

interface FileData {
  uri: string;
  type: string;
  name: string;
  base64?: string;
}

const useWebView = () => {
  const [loadProgress, setLoadProgress] = useState(0);
  const ref = useRef<WebView>(null);
  const navigation = useNavigationService();
  const [tokens, setTokens] = useState({ csrftoken: '', access_token: '' });
  const { getCookie } = CookieStorage;
  const { registerOrUpdatePushToken } = useFirebaseMessage();
  const [isCanGoBack, setIsCanGoBack] = useState(false);
  const { handleLogout } = useAnalytics(tokens);
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

  // 📸 카메라 촬영
  const openCamera = useCallback(() => {
    ImagePicker.openCamera({
      width: 300,
      height: 400,
      cropping: true,
      compressImageQuality: 0.8,
      includeBase64: true,
    })
      .then((image) => {
        sendFileToWeb(image);
      })
      .catch((error) => {
        console.log('Camera Error: ', error);
      });
  }, []);

  // 📂 갤러리에서 파일 선택
  const openGallery = useCallback(() => {
    console.log('openGallery');
    ImagePicker.openPicker({
      width: 300,
      height: 400,
      cropping: true,
      multiple: false,
      compressImageQuality: 0.8,
      includeBase64: true,
    })
      .then((image) => {
        sendFileToWeb(image);
      })
      .catch((error) => {
        console.log('Gallery Error: ', error);
      });
  }, []);

  const sendFileToWeb = useCallback(
    (image: any) => {
      const fileData: FileData = {
        uri: image.path,
        type: image.mime,
        name: image.path.split('/').pop() || 'upload.jpg',
        base64: image.data,
      };

      postMessage('FILE_SELECTED', fileData);
    },
    [postMessage],
  );

  /**
   * 웹뷰에서 오는 요청 처리
   */
  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      // Handle special case for navigation state change
      if (event.nativeEvent.data === 'navigationStateChange') {
        setIsCanGoBack(event.nativeEvent.canGoBack);
        return;
      }

      // Try to parse the data as JSON
      let data;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch (error) {
        console.warn(
          'JSON parsing error:',
          error,
          'Data:',
          event.nativeEvent.data,
        );
        return;
      }

      // Handle specific action types
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
          return navigation.push(
            data.screenName as keyof ScreenRouteParamList,
            {
              ...data.params,
            },
          );
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

          // 세션 종료
          await handleLogout();

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
        case 'OPEN_GALLERY':
          openGallery();
          return;
        case 'OPEN_CAMERA':
          openCamera();
          return;
        default:
          return;
      }
    },
    [openCamera, openGallery],
  );

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
    isCanGoBack,
    openCamera,
    openGallery,
  };
};

export default useWebView;
