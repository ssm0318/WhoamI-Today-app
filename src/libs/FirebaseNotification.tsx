import { APP_CONSTS } from '../constants';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import LocalNotification from './LocalNotification';
import { Alert, Linking } from 'react-native';

export default (() => {
  let isInitialized = false;
  let token: null | string = null;

  /**
   * getToken
   */
  const getToken = async () => {
    token = await messaging().getToken();
    return token;
  };

  /**
   * checkToken
   */
  const checkToken = async () => {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log(`[FirebaseNotification] your token is ${fcmToken}`);
    }
  };

  /**
   * initialize
   */
  const initialize = async () => {
    if (isInitialized) return;

    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      console.log('[FirebaseNotification] registerDeviceForRemoteMessages');
      messaging().registerDeviceForRemoteMessages();
    }

    messaging().onMessage(handleOnMessage);
    messaging().setBackgroundMessageHandler(handleOnMessage);
  };

  /**
   * IOS: 푸시를 누른 시점에 발생하는 이벤트라 바로 네비게이팅
   * Android: 푸시가 발생한 시점에 발생하는 이벤트 & 실제 푸시는 보이지 않기 때문에 로컬 노티로 복사하여 보여줌.
   * 이후 로컬 노티를 누르면 네비게이팅
   */
  const handleOnMessage = async (
    event: FirebaseMessagingTypes.RemoteMessage,
  ) => {
    console.log('[FirebaseNotification] handle on message', event);

    const { data } = event;

    const granted = await LocalNotification.getIsNotificationGranted();
    if (!granted) return;

    if (!data) return;
    const { body, type, tag } = data;

    const displayedNotificationList =
      await LocalNotification.getDisplayedNotifications();

    if (type === 'cancel') {
      const target = displayedNotificationList.find(
        (dn) => dn.notification.data?.tag === tag,
      );
      // 현재 읽지 않은 노티 중에 같은 tag가 존재한다면
      if (target && target.id) {
        LocalNotification.cancelDisplayedNotification(target.id);
      }
      // 존재하지 않는다면 아무 처리 안함
      return;
    }

    return LocalNotification.immediate({
      title: 'Diivers',
      body: body || '',
      data,
    });
  };

  /**
   * getInitialNotification
   */
  const getInitialNotification = () => messaging().getInitialNotification();

  /**
   * requestUserPermission
   */
  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      Alert.alert(
        '알림 설정',
        '알림 권한 설정은 휴대폰 설정에서 변경 가능합니다.',
        [
          {
            text: '닫기',
            style: 'cancel',
          },
          {
            text: '설정으로 이동',
            onPress: () => {
              if (APP_CONSTS.IS_ANDROID) Linking.openURL('App-Prefs:root');
              else Linking.openURL('app-settings:');
            },
            style: 'default',
          },
        ],
      );
    }

    console.log(
      '[FirebaseNotification] requestPermission authStatus is ',
      authStatus,
    );

    return { enabled };
  };

  return {
    initialize,
    getToken,
    checkToken,
    getInitialNotification,
    requestUserPermission,
  };
})();
