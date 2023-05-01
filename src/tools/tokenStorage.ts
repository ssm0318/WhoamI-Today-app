import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEYS = {
  TOKEN: 'TOKEN',
};

// async storage를 활용한 토큰 저장소 (refresh, access)
export const TokenStorage = (() => {
  const setToken = async ({
    refresh,
    access,
  }: {
    refresh: string;
    access: string;
  }) => {
    if (!refresh || !access) return;
    await AsyncStorage.setItem(
      TOKEN_STORAGE_KEYS.TOKEN,
      JSON.stringify({ refresh, access }),
    );
  };

  const getToken = async () => {
    try {
      const data = (await AsyncStorage.getItem(TOKEN_STORAGE_KEYS.TOKEN)) || '';
      const { refresh, access } = JSON.parse(data);
      return { refresh, access };
    } catch {
      return { refresh: null, access: null };
    }
  };

  const removeToken = () => AsyncStorage.removeItem(TOKEN_STORAGE_KEYS.TOKEN);

  return { setToken, getToken, removeToken };
})();
