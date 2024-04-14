import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCESS_TOKEN = 'ACESS_TOKEN';

// TODO refactoring
export const TokenStorage = (() => {
  const setToken = async ({ accessToken }: { accessToken: string }) => {
    await AsyncStorage.setItem(
      ACCESS_TOKEN,
      JSON.stringify({
        accessToken,
      }),
    );
  };

  const getToken = async (): Promise<string> => {
    const data = (await AsyncStorage.getItem(ACCESS_TOKEN)) || '';
    if (!data) return '';
    const { accessToken } = JSON.parse(data);
    return accessToken;
  };

  const removeToken = () => AsyncStorage.removeItem(ACCESS_TOKEN);

  return { setToken, getToken, removeToken };
})();
