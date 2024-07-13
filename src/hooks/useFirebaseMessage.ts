import { useCallback } from 'react';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import { pushNotificationApis } from '@apis';
import { APP_CONSTS } from '@constants';
import { FcmTokenStorage } from '@tools';
import { displayNotification } from '../tools/pushNotiHelper';

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

  const initialize = useCallback(async () => {
    console.log('[Firebase Message] : initialize');
    messaging().onMessage(handleOnMessage);
  }, []);

  const updatePushToken = useCallback(async () => {
    if (await DeviceInfo.isEmulator()) return;
    try {
      if (!(await requestPermissionIfNot())) {
        return console.log(
          '[Firebase Device Token]: user rejected push permission',
        );
      }
      const pushToken = await messaging().getToken();
      await FcmTokenStorage.setToken({ fcmToken: pushToken });
      console.log('[Firebase Device Token] : ', pushToken);
      await pushNotificationApis.registerPushToken({
        type: APP_CONSTS.IS_ANDROID ? 'android' : 'ios',
        registration_id: pushToken,
        active: true,
      });
    } catch (e) {
      console.log(e);
    }
  }, []);

  const deletePushToken = useCallback(async () => {
    if (await DeviceInfo.isEmulator()) return;
    try {
      const { fcmToken: pushToken } = await FcmTokenStorage.getToken();
      if (!pushToken) return;
      await FcmTokenStorage.removeToken();
      await pushNotificationApis.registerPushToken({
        type: APP_CONSTS.IS_ANDROID ? 'android' : 'ios',
        registration_id: pushToken,
        active: false,
      });
      await messaging().deleteToken();
    } catch (e) {
      console.log(e);
    }
  }, []);

  return {
    initialize,
    handleOnMessage,
    hasPermission,
    requestPermissionIfNot,
    deletePushToken,
    updatePushToken,
  };
};

export default useFirebaseMessage;
