import AsyncStorage from '@react-native-async-storage/async-storage';

export const FCM_TOKEN_STORAGE_KEYS = {
  FCM_TOKEN: 'FCM_TOKEN',
};

export const FcmTokenStorage = (() => {
  // FCM 토큰 등록 (로컬 스토리지에)
  const setToken = async ({ fcmToken }: { fcmToken: string }) => {
    await AsyncStorage.setItem(
      FCM_TOKEN_STORAGE_KEYS.FCM_TOKEN,
      JSON.stringify({ fcmToken }),
    );
  };

  // FCM 토큰 가져오기
  const getToken = async (): Promise<{ fcmToken: string }> => {
    try {
      const data =
        (await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEYS.FCM_TOKEN)) || '';
      const { fcmToken } = JSON.parse(data);
      return { fcmToken };
    } catch {
      return { fcmToken: '' };
    }
  };

  // FCM 토큰 삭제
  const removeToken = () =>
    AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEYS.FCM_TOKEN);

  return { setToken, getToken, removeToken };
})();
