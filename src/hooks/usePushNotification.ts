import { FcmTokenStorage } from '@tools';
import { FirebaseNotification } from '@libs';
import { useTranslation } from 'react-i18next';
import { fcmApis } from '@apis';
import { APP_CONSTS } from '@constants';

const usePushNotification = () => {
  const [notiTranslation] = useTranslation('translation', {
    keyPrefix: 'noti_permission',
  });

  const initializeFcm = async () => {
    // initialize FirebaseNotification
    FirebaseNotification.initialize();

    const token = await FirebaseNotification.getToken();
    if (token) await registerFcmToken(token, true);
    // 처음에 푸시 알림 권한 없으면 권한 허용 팝업 노출
    FirebaseNotification.getPermissionEnabled().then((enabled) => {
      if (!enabled) {
        FirebaseNotification.requestPermission(notiTranslation);
      }
    });
  };

  // fcm 토큰 서버에 저장
  const registerFcmToken = async (token: string, active: boolean) => {
    await fcmApis.registerFCMToken({
      type: APP_CONSTS.IS_ANDROID ? 'android' : 'ios',
      registration_id: token,
      active,
    });
  };

  // fcm 토큰 업데이트
  const updateFcmToken = async (enabled: boolean) => {
    const { fcmToken } = await FcmTokenStorage.getToken();
    if (enabled) {
      if (!fcmToken) return;
      await registerFcmToken(fcmToken, true);
    } else {
      await FcmTokenStorage.removeToken();
    }
  };

  return {
    initializeFcm,
    registerFcmToken,
    updateFcmToken,
  };
};
export default usePushNotification;
