import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  NotificationAndroid,
} from '@notifee/react-native';
import WebView from 'react-native-webview';
import i18n from 'i18next';
import { APP_CONSTS, WEBVIEW_CONSTS } from '@constants';
import NavigationService from '@libs/NavigationService';

export type LocalMessage = {
  title: string;
  body: string;
  message_en: string;
  message_ko: string;
  type: 'new' | 'cancel';
  tag: string;
  url: string;
};

const useLocalMessage = () => {
  const androidChannelId = useCallback(async () => {
    const channelId = await notifee.createChannel({
      id: 'WhoAmI Today',
      name: 'WhoAmI Today',
      vibration: true,
      visibility: AndroidVisibility.PUBLIC,
      importance: AndroidImportance.HIGH,
    });

    return channelId;
  }, []);

  const hasNotificationPermission = useCallback(async () => {
    const settings = await notifee.getNotificationSettings();

    return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
  }, []);

  const initialize = () => {
    console.log('[Local Message] : initialize');
    notifee.onForegroundEvent((event) => {
      if (event.type === EventType.PRESS) {
        const url = event.detail.notification?.data?.url;
        if (typeof url !== 'string') return;
        NavigationService.navigate('AppScreen', {
          url,
        });
      }
    });

    notifee.onBackgroundEvent(async (event) => {
      if (event.type === EventType.PRESS) {
        const url = event.detail.notification?.data?.url;
        if (typeof url !== 'string') return;
        NavigationService.navigate('AppScreen', {
          url,
        });
      }
    });
  };

  const getSettingsForAndroid =
    useCallback(async (): Promise<NotificationAndroid> => {
      return {
        channelId: await androidChannelId(),
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        smallIcon: 'ic_launcher',
      };
    }, []);

  const displayNotification = useCallback(async (message: LocalMessage) => {
    const { title, body, message_en, message_ko, ...data } = message;

    const translatedMessage = i18n.language === 'ko' ? message_ko : message_en;

    notifee.displayNotification({
      title,
      body: translatedMessage || body,
      data,
      ...(APP_CONSTS.IS_ANDROID
        ? {
            android: await getSettingsForAndroid(),
          }
        : {}),
    });
  }, []);

  return {
    initialize,
    displayNotification,
    hasNotificationPermission,
  };
};

export default useLocalMessage;
