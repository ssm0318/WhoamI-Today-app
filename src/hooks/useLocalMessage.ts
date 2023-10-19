import { useCallback } from 'react';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  Event,
  EventType,
  NotificationAndroid,
} from '@notifee/react-native';
import i18n from 'i18next';
import { APP_CONSTS } from '@constants';
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
    const handleNavigate = async (event: Event) => {
      if (event.type === EventType.PRESS) {
        const url = event.detail.notification?.data?.url;
        if (typeof url !== 'string') return;
        NavigationService.navigate('AppScreen', {
          url,
        });
      }
    };

    notifee.onForegroundEvent(handleNavigate);
    notifee.onBackgroundEvent(handleNavigate);
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

    // type = cancel 경우 해당 tag를 가진 noti 삭제
    if (data?.type === 'cancel') {
      const displayedNotifications = await getDisplayedNotifications();
      const noti = displayedNotifications.find(
        (noti) => noti.notification?.data?.tag === data.tag,
      );
      if (!noti || !noti.id) return;
      return await cancelNotification(noti.id);
    }

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

  const cancelNotification = useCallback(async (notificationId: string) => {
    await notifee.cancelNotification(notificationId);
  }, []);

  const getDisplayedNotifications = useCallback(async () => {
    const notifications = await notifee.getDisplayedNotifications();
    return notifications;
  }, []);

  return {
    initialize,
    displayNotification,
    hasNotificationPermission,
    cancelNotification,
  };
};

export default useLocalMessage;
