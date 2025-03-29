import { useCallback } from 'react';
import analytics from '@react-native-firebase/analytics';
import { AppStateStatus } from 'react-native';
import useAppStateEffect from './useAppStateEffect';
import useAsyncEffect from './useAsyncEffect';
import { userApis } from '@apis';

const useAnalytics = (tokens: {
  access_token?: string;
  csrftoken?: string;
}) => {
  const analyticsInstance = analytics();

  const setUserProperties = async ({
    username,
    userId,
  }: {
    username: string;
    userId: string;
  }) => {
    console.log('[useAnalytics] setUserProperties', {
      username,
      userId,
    });
    await analyticsInstance.setUserId(userId);
    await analyticsInstance.setUserProperties({
      username: username,
      user_id: userId,
    });
  };

  const trackEvent = async (
    eventName: 'session_end' | 'custom_session_start' | 'logout',
    params?: Record<string, any>,
  ) => {
    try {
      await analyticsInstance.logEvent(eventName, {
        ...params,
      });
      console.log(`[useAnalytics] Logged event: ${eventName}`, params);
    } catch (e) {
      console.log('[useAnalytics] logEvent failed', e);
    }
  };

  const handleAppStateChange = useCallback(async (state: AppStateStatus) => {
    if (state.match(/inactive|background/)) {
      console.log('[useAnalytics] App is inactive or background');
      // 앱이 백그라운드로 갔을 때
      trackEvent('session_end');
    } else {
      console.log('[useAnalytics] App is active');
      trackEvent('custom_session_start');
    }
  }, []);

  const handleLogout = async () => {
    console.log('[useAnalytics] handleLogout');

    await trackEvent('logout');

    // 이후 user 식별자/속성 제거
    await analyticsInstance.setUserId(null);
    await analyticsInstance.setUserProperties({
      username: null,
      user_id: null,
    });

    await trackEvent('session_end');
  };

  // On mount, track session start
  useAppStateEffect(handleAppStateChange, []);

  useAsyncEffect(async () => {
    console.log('[useAnalytics] useAsyncEffect', tokens);
    if (!tokens.access_token || !tokens.csrftoken) return;
    try {
      const me = await userApis.getMe();
      await setUserProperties({
        username: me.username,
        userId: String(me.id),
      });

      await trackEvent('custom_session_start');
    } catch (e) {
      console.log('[useAnalytics] setUserProperties failed', e);
    }
  }, [tokens]);

  return {
    setUserProperties,
    trackEvent,
    handleLogout,
  };
};

export default useAnalytics;
