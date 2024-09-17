import { useCallback } from 'react';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import { notificationApis, pushNotificationApis } from '@apis';
import { APP_CONSTS } from '@constants';
import { FcmTokenStorage } from '@tools';
import { displayNotification } from '../tools/pushNotiHelper';
import notifee, { EventType } from '@notifee/react-native';
import NavigationService from '@libs/NavigationService';

const useFirebaseMessage = () => {
  const handleOnMessage = useCallback(
    (message: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[Firebase Remote Message] : ', message);
      displayNotification(message);
    },
    [],
  );

  const isPermitted = (
    status: FirebaseMessagingTypes.AuthorizationStatus,
  ): boolean => {
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  };

  const requestPermissionIfNot = async (): Promise<boolean> => {
    let enabled = isPermitted(await messaging().hasPermission());
    if (!enabled) {
      enabled = isPermitted(await messaging().requestPermission());
    }

    return enabled;
  };

  const hasPermission = async (): Promise<boolean> =>
    isPermitted(await messaging().hasPermission());

  const handleNotificationPress = useCallback(
    (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[Firebase Message] : Notification pressed', remoteMessage);

      // Extract navigation data from the notification
      const { data } = remoteMessage;
      if (data && data.screen) {
        // Navigate to the specified screen
        console.log('[Firebase Message] : Navigate to screen', data.url);
      }
    },
    [],
  );

  const initialize = useCallback(async () => {
    console.log('[Firebase Message] : initialize');

    // Handle foreground messages
    messaging().onMessage(handleOnMessage);

    // Handle notification presses when app is in background
    messaging().onNotificationOpenedApp(handleNotificationPress);

    // Check if app was opened from a notification
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      handleNotificationPress(initialNotification);
    }

    // Handle notification presses for foreground notifications
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const destinationUrl = detail.notification?.data?.url;
        const notificationId = Number(detail.notification?.id);
        if (destinationUrl && typeof destinationUrl === 'string') {
          NavigationService.navigate('AppScreen', {
            url: destinationUrl,
          });

          // 알림 읽음 처리
          notificationApis.readNotification([notificationId]);
        }
      }
    });
  }, [handleNotificationPress]);

  const registerOrUpdatePushToken = useCallback(async (active: boolean) => {
    if (await DeviceInfo.isEmulator()) return;
    try {
      const pushToken = await messaging().getToken();
      await FcmTokenStorage.setToken({ fcmToken: pushToken });
      console.log('[Firebase Device Token] : ', pushToken);
      await pushNotificationApis.registerPushToken({
        device_id: await DeviceInfo.getUniqueId(),
        type: APP_CONSTS.IS_ANDROID ? 'android' : 'ios',
        registration_id: pushToken,
        active,
      });
    } catch (e) {
      console.log(e);
    }
  }, []);

  return {
    initialize,
    handleOnMessage,
    hasPermission,
    requestPermissionIfNot,
    registerOrUpdatePushToken,
  };
};

export default useFirebaseMessage;
