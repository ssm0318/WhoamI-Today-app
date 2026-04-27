import analytics from '@react-native-firebase/analytics';

export interface AnalyticsUserProperties {
  user_type: string;
  user_group: string;
  current_ver: string;
  ver_changed: string;
  gender: string;
  age_range: string;
  signup_date: string;
  friend_count_tier: string;
  notification_enabled: string;
}

export const setAnalyticsUser = async (
  userId: number,
  properties: AnalyticsUserProperties,
) => {
  try {
    await analytics().setUserId(String(userId));
    await analytics().setUserProperties(
      properties as unknown as { [key: string]: string | null },
    );
  } catch (e) {
    console.warn('[Analytics] setAnalyticsUser failed:', e);
  }
};

export const trackScreenView = async (
  screenName: string,
  screenPath: string,
) => {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenPath,
    });
  } catch (e) {
    console.warn('[Analytics] trackScreenView failed:', e);
  }
};

export const trackEvent = async (
  name: string,
  params?: Record<string, string | number>,
) => {
  try {
    await analytics().logEvent(name, params || {});
  } catch (e) {
    console.warn('[Analytics] trackEvent failed:', e);
  }
};
