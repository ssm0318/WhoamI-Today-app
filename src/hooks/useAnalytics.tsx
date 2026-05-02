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

  // Generic counterpart to trackEvent for events forwarded from the
  // WebView (browse_mode_picked, etc.). Same fire-and-forget behaviour.
  const trackBridgedEvent = async (
    eventName: string,
    params?: Record<string, any>,
  ) => {
    try {
      await analyticsInstance.logEvent(eventName, { ...params });
    } catch (e) {
      console.log('[useAnalytics] bridged logEvent failed', eventName, e);
    }
  };

  const trackBridgedScreenView = async (params: {
    page_name: string;
    page_path: string;
  }) => {
    try {
      await analyticsInstance.logScreenView({
        screen_name: params.page_name,
        screen_class: params.page_path,
      });
    } catch (e) {
      console.log('[useAnalytics] bridged logScreenView failed', e);
    }
  };

  const setBridgedUserProperties = async (props: Record<string, any>) => {
    try {
      const { user_id, ...rest } = props;
      if (user_id !== undefined && user_id !== null) {
        await analyticsInstance.setUserId(String(user_id));
      }
      // Firebase requires string values for setUserProperties.
      const stringProps: Record<string, string> = {};
      Object.entries(rest).forEach(([k, v]) => {
        stringProps[k] = v === null || v === undefined ? '' : String(v);
      });
      await analyticsInstance.setUserProperties(stringProps);
    } catch (e) {
      console.log('[useAnalytics] bridged setUserProperties failed', e);
    }
  };

  const handleAppStateChange = useCallback(async (state: AppStateStatus) => {
    if (state.match(/inactive|background/)) {
      console.log('[useAnalytics] App is inactive or background');
      // When app goes to background
      trackEvent('session_end');
    } else {
      console.log('[useAnalytics] App is active');
      trackEvent('custom_session_start');
    }
  }, []);

  const handleLogout = async () => {
    console.log('[useAnalytics] handleLogout');

    await trackEvent('logout');

    // Remove user identifier/properties afterward
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
    trackBridgedEvent,
    trackBridgedScreenView,
    setBridgedUserProperties,
  };
};

export default useAnalytics;
