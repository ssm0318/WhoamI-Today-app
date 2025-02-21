import { useState } from 'react';
import { userApis } from '@apis';
import { userVersionStorage } from '@tools';
import { VersionType } from '../types/user.type';

const useVersionInfo = () => {
  const [userVersion, setUserVersion] = useState<string | null>(null);

  // 현재 storage에 저장된 version을 가져오는 함수
  const getStoredVersion = async () => {
    try {
      const version = await userVersionStorage.get();
      console.log('[useVersionInfo] Stored user version:', version);
      setUserVersion(version);
      return version;
    } catch (error) {
      console.error('[useVersionInfo] Error getting stored version:', error);
      return null;
    }
  };

  // API로부터 최신 버전을 가져와서 storage의 버전과 비교하는 함수
  const checkAndUpdateVersion = async () => {
    try {
      console.log('checkAndUpdateVersion');
      const meResponse = await userApis.getMe();
      const currentVersion = meResponse.current_ver ?? VersionType.DEFAULT;

      const storedVersion = await userVersionStorage.get();
      const hasChanged = storedVersion !== currentVersion;

      if (hasChanged) {
        await userVersionStorage.checkAndUpdate(currentVersion);
        setUserVersion(currentVersion);
        console.log('[useVersionInfo] Version updated:', currentVersion);
      }

      return {
        hasChanged,
        currentVersion,
        storedVersion,
      };
    } catch (error) {
      console.error('[useVersionInfo] Error checking version:', error);
      return {
        hasChanged: false,
        error,
      };
    }
  };

  return {
    userVersion,
    getStoredVersion,
    checkAndUpdateVersion,
  };
};

export default useVersionInfo;
