import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { sessionApis } from '@apis';
import { CookieStorage } from '@tools';

const useSession = () => {
  const appState = useRef(AppState.currentState);
  const pingInterval = useRef<NodeJS.Timeout>();
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
        startPingInterval();
      } catch (error) {
        console.error('❌ Failed to start session:', error);
      }
    } else {
      console.log('🔒 No access token found, skipping session start');
    }
  };

  const startPingInterval = () => {
    // 1분마다 ping 보내기
    pingInterval.current = setInterval(() => {
      sessionApis
        .sendPing()
        .then(() => console.log('🟢 Session ping sent'))
        .catch((error: Error) => {
          console.error('🔴 Failed to send ping:', error);
        });
    }, 60000);
  };

  const stopPingInterval = () => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = undefined;
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
          stopPingInterval();
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
      stopPingInterval();
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
