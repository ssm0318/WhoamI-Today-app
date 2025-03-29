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
import { PermissionsAndroid, Platform } from 'react-native';
import { AxiosError } from 'axios';

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
    try {
      // Android 13 이상에서는 POST_NOTIFICATIONS 권한 필요
      if (APP_CONSTS.IS_ANDROID && Number(Platform.Version) >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }

      let enabled = isPermitted(await messaging().hasPermission());
      if (!enabled) {
        enabled = isPermitted(await messaging().requestPermission());
      }

      return enabled;
    } catch (error) {
      // console.log('Permission request error:', error);
      return false;
    }
  };

  const hasPermission = async (): Promise<boolean> => {
    const permissionStatus = await messaging().hasPermission();
    const permitted = isPermitted(permissionStatus);
    // console.log('[Firebase] Permission status:', {
    //   status: permissionStatus,
    //   permitted,
    //   currentToken: await messaging().getToken(),
    // });
    return permitted;
  };

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
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        const destinationUrl = detail.notification?.data?.url;
        const notificationId = Number(detail.notification?.data?.tag);
        if (destinationUrl && typeof destinationUrl === 'string') {
          // 알림 읽음 처리
          await notificationApis.readNotification([notificationId]);

          NavigationService.navigate('AppScreen', {
            url: destinationUrl,
          });
        }
      }
    });
  }, [handleNotificationPress]);

  const registerOrUpdatePushToken = useCallback(
    async (
      tokens: { access_token: string; csrftoken: string },
      active: boolean,
    ) => {
      try {
        if (!tokens.access_token || !tokens.csrftoken) {
          console.log('[Firebase Message] : Missing authentication tokens');
          return;
        }

        const pushToken = await messaging().getToken();
        await FcmTokenStorage.setToken({ fcmToken: pushToken });

        const params = {
          device_id: await DeviceInfo.getUniqueId(),
          type: APP_CONSTS.IS_ANDROID ? 'android' : 'ios',
          registration_id: pushToken,
          active,
        };

        await pushNotificationApis.registerPushToken(params);
      } catch (e: unknown) {
        if (e instanceof AxiosError && e.response) {
          console.log('[Firebase Message] : Error registering push token', e);
        } else {
          console.log('[Firebase Message] : Error registering push token', e);
        }
      }
    },
    [],
  );

  return {
    initialize,
    handleOnMessage,
    hasPermission,
    requestPermissionIfNot,
    registerOrUpdatePushToken,
  };
};

export default useFirebaseMessage;
