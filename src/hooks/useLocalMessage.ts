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
      console.log('onForegroundEvent', event);
      if (event.type === EventType.PRESS) {
        const url = event.detail.notification?.data?.url;
        if (typeof url !== 'string') return;
        console.log(51, url);
        NavigationService.navigate('AppScreen', {
          url,
        });
      }
    });

    notifee.onBackgroundEvent(async (event) => {
      console.log('onBackgroundEvent', event);
      if (event.type === EventType.PRESS) {
        const url = event.detail.notification?.data?.url;
        if (typeof url !== 'string') return;
        console.log(61, url);
        NavigationService.navigate('AppScreen', {
          url,
        });
      }
    });
  };

  const requestPermission = useCallback(async () => {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return Alert.alert(
        '알림 권한이 필요해요',
        '앱 설정에서 알림을 허용하고 알림 기능을 사용하시겠어요?',
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '설정하러 가기',
            onPress: async () => {
              if (APP_CONSTS.IS_ANDROID)
                await notifee.openAlarmPermissionSettings();
              else await Linking.openSettings();
            },
          },
        ],
      );
    }
  }, []);

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
    requestPermission,
    displayNotification,
    hasNotificationPermission,
  };
};

export default useLocalMessage;