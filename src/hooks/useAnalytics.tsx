import { useEffect, useRef } from 'react';
import analytics from '@react-native-firebase/analytics';
import { AppState, AppStateStatus } from 'react-native';

const useAnalytics = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const trackEvent = async (
    eventName: string,
    params?: Record<string, any>,
  ) => {
    try {
      await analytics().logEvent(eventName, params);
      console.log(`[useAnalytics] Logged event: ${eventName}`, params);
    } catch (e) {
      console.log('[useAnalytics] logEvent failed', e);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevAppState = appState.current;

      if (
        prevAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // 앱이 다시 포그라운드로 옴
        trackEvent('session_start');
      }

      if (
        prevAppState === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // 앱이 백그라운드로 감
        trackEvent('session_end');
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // 첫 진입시 1회
    trackEvent('session_start');

    return () => {
      subscription.remove();
      trackEvent('session_end'); // 앱 종료
    };
  }, []);

  return {
    trackEvent,
  };
};

export default useAnalytics;
