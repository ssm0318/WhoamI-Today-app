import { fcmApis } from '@apis';
import { FcmTokenStorage } from '@tools';
import { Platform } from 'react-native';

// 유저의 FCM 토큰 저장 (api 호출)
export const registerFCMToken = async (fcmToken: string, isActive: boolean) => {
  await fcmApis.registerFCMToken({
    type: Platform.OS === 'android' ? 'android' : 'ios',
    registration_id: fcmToken,
    active: isActive,
  });
  // 안전성을 위해 다시 한번 로컬 스토리지에 저장해줌
  await FcmTokenStorage.setToken({
    fcmToken,
  });
};
