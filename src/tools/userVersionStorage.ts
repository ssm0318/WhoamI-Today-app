import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionType } from '../types/user.type';

const USER_VERSION_KEY = '@user_version';

export const userVersionStorage = {
  get: () => AsyncStorage.getItem(USER_VERSION_KEY),

  checkAndUpdate: async (currentVer: VersionType) => {
    console.log('[UserVersionStorage] Checking version:', currentVer);
    const previousVersion = await AsyncStorage.getItem(USER_VERSION_KEY);

    console.log('[UserVersionStorage] Version comparison:', {
      currentVer,
      previousVersion,
    });

    if (previousVersion !== currentVer) {
      await AsyncStorage.setItem(
        USER_VERSION_KEY,
        currentVer || VersionType.DEFAULT,
      );
      return true;
    }
    return false;
  },
};
