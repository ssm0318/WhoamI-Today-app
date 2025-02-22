import { useState, useRef, useCallback } from 'react';
import { userApis } from '@apis';
import { userVersionStorage } from '@tools';
import { VersionType } from '../types/user.type';

const DEBOUNCE_TIME = 1000; // 1초

type VersionCheckResult = {
  hasChanged: boolean;
  currentVersion?: string;
  storedVersion?: string | null;
  error?: any;
} | null;

const useVersionInfo = () => {
  const [userVersion, setUserVersion] = useState<string | null>(null);
  const lastCheckTime = useRef<number>(0);
  const isChecking = useRef<boolean>(false);
  const initializeAttempts = useRef<number>(0);
  const MAX_ATTEMPTS = 2;

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
  const checkAndUpdateVersion =
    useCallback(async (): Promise<VersionCheckResult> => {
      const now = Date.now();

      if (isChecking.current || now - lastCheckTime.current < DEBOUNCE_TIME) {
        console.log(
          '[useVersionInfo] Skip version check - too frequent or already checking',
        );
        return null;
      }

      try {
        isChecking.current = true;
        console.log(
          '[useVersionInfo] Checking version... Attempt:',
          initializeAttempts.current + 1,
        );

        const meResponse = await userApis.getMe();
        console.log('[useVersionInfo] getMe API response:', meResponse);

        const currentVersion = meResponse.current_ver ?? VersionType.DEFAULT;
        const storedVersion = await userVersionStorage.get();
        const hasChanged = storedVersion !== currentVersion;

        if (hasChanged) {
          await userVersionStorage.checkAndUpdate(currentVersion);
          setUserVersion(currentVersion);
          console.log(
            '🔄 [useVersionInfo] Version Change Detected!\n',
            '📱 Previous Version:',
            storedVersion,
            '\n',
            '✨ New Version:',
            currentVersion,
          );
        }

        lastCheckTime.current = Date.now();
        initializeAttempts.current = 0; // 성공하면 시도 횟수 리셋

        return {
          hasChanged,
          currentVersion,
          storedVersion,
        };
      } catch (error) {
        console.error('[useVersionInfo] Error checking version:', error);

        // 최대 시도 횟수를 초과하지 않았다면 재시도
        if (initializeAttempts.current < MAX_ATTEMPTS) {
          initializeAttempts.current += 1;
          console.log(
            '[useVersionInfo] Retrying... Attempt:',
            initializeAttempts.current,
          );
          // 잠시 대기 후 재시도
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return checkAndUpdateVersion();
        }

        return {
          hasChanged: false,
          error,
        };
      } finally {
        isChecking.current = false;
      }
    }, []);

  return {
    userVersion,
    getStoredVersion,
    checkAndUpdateVersion,
  };
};

export default useVersionInfo;
