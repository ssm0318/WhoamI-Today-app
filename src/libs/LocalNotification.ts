import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  Notification,
  NotificationAndroid,
} from '@notifee/react-native';
import { APP_CONSTS } from '../constants';
import WebView from 'react-native-webview';

export default (() => {
  const androidChannelId = Platform.select({
    android: notifee.createChannel({
      id: 'Diivers',
      name: 'Diivers',
      vibration: true,
      visibility: AndroidVisibility.PUBLIC,
      importance: AndroidImportance.HIGH,
    }),
    ios: undefined,
  });

  let isInitialized = false;

  const getAndroidSettings = async (): Promise<
    NotificationAndroid | undefined
  > => {
    if (APP_CONSTS.IS_IOS) return undefined;
    return {
      channelId: await androidChannelId,
      lightUpScreen: true,
      onlyAlertOnce: true,
      showTimestamp: true,
    };
  };

  const getNotificationSettings = async (
    title: string,
    body: string,
    data?: RouteDataType,
    thumbnail?: string,
    id?: string,
  ) => {
    const settings: Notification = {
      title,
      body,
      data,
    };

    if (APP_CONSTS.IS_IOS && thumbnail) {
      Object.assign(settings, { ios: { attachments: [{ url: thumbnail }] } });
    }

    if (APP_CONSTS.IS_ANDROID) {
      Object.assign(settings, {
        android: {
          ...(await getAndroidSettings()),
          pressAction: { id: 'default', launchActivity: 'default' },
        },
      });
    }

    if (id) Object.assign(settings, { id });

    return settings;
  };

  /**
   * 로컬 알림 즉시 실행
   *
   * @param {LocalNotification} notification
   * @example
   *
   * ```ts
   *  LocalNotification.immediate({
   *    title: 'TEST TITLE',
   *    body: 'TEST BODY',
   *    data: { url: '/post/123' },
   *  });
   * ```
   */
  const immediate = async (
    notification: Omit<LocalNotification, 'date'>,
    options?: RequestPermissionOption,
  ) => {
    try {
      const { title, body, data = {} } = notification;
      await requestPermission(options || {});

      await notifee.displayNotification(
        await getNotificationSettings(title, body, data),
      );
    } catch (error) {
      console.log(error);
    }
  };

  const getIsNotificationGranted = async () => {
    const { authorizationStatus } = await notifee.getNotificationSettings();
    return authorizationStatus === 2 || authorizationStatus === 1;
  };

  const cancelByIds = (ids: string[]) => notifee.cancelAllNotifications(ids);

  const cancelAll = () => notifee.cancelAllNotifications();

  const cancelDisplayedNotification = (id: string) => {
    notifee.cancelDisplayedNotification(id);
  };

  const getDisplayedNotifications = () => {
    return notifee.getDisplayedNotifications();
  };

  /**
   * 알림 권한 요청
   * usePopUp DENIED 상태일 때 팝업을 사용할지 옵션
   */
  const requestPermission = async ({
    usePopUp = false,
  }: RequestPermissionOption) => {
    const { authorizationStatus } = await notifee.requestPermission();

    if (usePopUp && authorizationStatus === AuthorizationStatus.DENIED) {
      //TODO(지나): 알림 권한 물어보기 추가
      throw new Error('[LocalNotification] requested permission');
    }
  };

  /**
   * navigate
   */
  const navigate = (webViewRef: React.RefObject<WebView>, url: string) => {
    webViewRef.current?.postMessage(JSON.stringify({ key: 'REDIRECT', url }));
  };

  const initialize = (webViewRef: React.RefObject<WebView>) => {
    if (isInitialized) return;

    notifee.onForegroundEvent((event) => {
      console.log('[LocalNotification] foreground event', event);
      if (event.type === EventType.PRESS) {
        if (!event.detail.notification) return;
        const { data } = event.detail.notification;
        if (!data) return;
        const { url } = data;
        navigate(webViewRef, String(url));
      }
    });

    console.log('[LocalNotification] start listening notification events 👀');

    isInitialized = true;
  };

  return {
    immediate,
    cancelByIds,
    cancelAll,
    initialize,
    requestPermission,
    cancelDisplayedNotification,
    getIsNotificationGranted,
    getDisplayedNotifications,
  };
})();

export type LocalNotification = {
  title: string;
  body: string;
  date: Date;
  data?: RouteDataType;
  thumbnail?: string;
} & Partial<Notification>;

type RequestPermissionOption = { usePopUp?: boolean };

type RouteDataType = Record<string, any>;
