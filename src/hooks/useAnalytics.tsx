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
    console.log('[useAnalytics] setUserProperties', userId);
    await analyticsInstance.setUserId(userId);
    await analyticsInstance.setUserProperties({
      username: username,
      user_id: userId,
    });
  };

  const trackEvent = async (
    eventName: 'session_end' | 'logout',
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

  // Add a new function to track screen views with the URL path
  const trackScreenView = async (urlPath: string) => {
    try {
      // Only use the path portion after the domain (just as requested)
      const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;

      await analyticsInstance.logScreenView({
        screen_name: path,
        screen_class: path,
      });
      console.log(`[useAnalytics] Logged screen view: ${path}`);
    } catch (e) {
      console.log('[useAnalytics] logScreenView failed', e);
    }
  };

  const handleAppStateChange = useCallback(async (state: AppStateStatus) => {
    if (state.match(/inactive|background/)) {
      console.log('[useAnalytics] App is inactive or background');
      // 앱이 백그라운드로 갔을 때
      trackEvent('session_end');
    }
  }, []);

  const handleLogout = async () => {
    console.log('[useAnalytics] handleLogout');
    await trackEvent('logout');
    await analyticsInstance.setUserId(null);
    await analyticsInstance.setUserProperties({
      username: null,
      user_id: null,
    });

    await analyticsInstance.resetAnalyticsData();
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
    } catch (e) {
      console.log('[useAnalytics] setUserProperties failed', e);
    }
  }, [tokens]);

  return {
    setUserProperties,
    trackEvent,
    trackScreenView,
    handleLogout,
  };
};

export default useAnalytics;
