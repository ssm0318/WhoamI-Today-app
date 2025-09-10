import AsyncStorage from '@react-native-async-storage/async-storage';

export const FCM_TOKEN_STORAGE_KEYS = {
  FCM_TOKEN: 'FCM_TOKEN',
};

export const FcmTokenStorage = (() => {
  // Register FCM token (to local storage)
  const setToken = async ({ fcmToken }: { fcmToken: string }) => {
    await AsyncStorage.setItem(
      FCM_TOKEN_STORAGE_KEYS.FCM_TOKEN,
      JSON.stringify({ fcmToken }),
    );
  };

  // Get FCM token
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

  // Delete FCM token
  const removeToken = () =>
    AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEYS.FCM_TOKEN);

  return { setToken, getToken, removeToken };
})();
