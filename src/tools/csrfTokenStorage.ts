import AsyncStorage from '@react-native-async-storage/async-storage';

export const CSRF_TOKEN = 'CSRF_TOKEN';

export const CsrfTokenStorage = (() => {
  const setToken = async ({ csrfToken }: { csrfToken: string }) => {
    await AsyncStorage.setItem(
      CSRF_TOKEN,
      JSON.stringify({
        csrfToken,
      }),
    );
  };

  const getToken = async (): Promise<string> => {
    const data = (await AsyncStorage.getItem(CSRF_TOKEN)) || '';
    if (!data) return '';
    const { csrfToken } = JSON.parse(data);
    return csrfToken;
  };

  const removeToken = () => AsyncStorage.removeItem(CSRF_TOKEN);

  return { setToken, getToken, removeToken };
})();
