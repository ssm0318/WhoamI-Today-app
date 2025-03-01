import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { sessionApis } from '@apis';
import { CookieStorage } from '@tools';

const useSession = () => {
  const appState = useRef(AppState.currentState);
  const touchInterval = useRef<NodeJS.Timeout>();
  const isAuthenticatedRef = useRef<boolean>(false);

  const isAuthenticated = async (): Promise<boolean> => {
    const { access_token } = await CookieStorage.getCookie();
    return !!access_token;
  };

  const startSessionIfAuthenticated = async () => {
    const authenticated = await isAuthenticated();
    isAuthenticatedRef.current = authenticated;

    if (authenticated) {
      console.log('🚀 Initializing session...');
      try {
        await sessionApis.startSession();
        console.log('✅ Session started successfully');
        startTouchInterval();
      } catch (error) {
        console.error('❌ Failed to start session:', error);
      }
    } else {
      console.log('🔒 No access token found, skipping session start');
    }
  };

  const startTouchInterval = () => {
    // 1분마다 touch 보내기
    touchInterval.current = setInterval(() => {
      sessionApis
        .sendTouch()
        .then(() => console.log('🟢 Session touch sent'))
        .catch((error: Error) => {
          console.error('🔴 Failed to send touch:', error);
        });
    }, 60000);
  };

  const stopTouchInterval = () => {
    if (touchInterval.current) {
      clearInterval(touchInterval.current);
      touchInterval.current = undefined;
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('📱 App came to foreground, checking authentication...');
      await startSessionIfAuthenticated();
    } else if (
      appState.current === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      if (isAuthenticatedRef.current) {
        console.log('💤 App going to background, ending session...');
        try {
          stopTouchInterval();
          await sessionApis.endSession();
          console.log('👋 Session ended successfully');
        } catch (error) {
          console.error('❌ Failed to end session:', error);
        }
      }
    }
    appState.current = nextAppState;
  };

  useEffect(() => {
    startSessionIfAuthenticated();

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      console.log('🧹 Cleaning up session...');
      stopTouchInterval();
      subscription.remove();
      if (isAuthenticatedRef.current) {
        sessionApis
          .endSession()
          .then(() => console.log('👋 Session cleanup completed'))
          .catch((error: Error) => {
            console.error('❌ Failed to end session on cleanup:', error);
          });
      }
    };
  }, []);
};

export default useSession;
