import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStateActiveEffect } from '@hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApis } from '@apis';
import { VersionType } from '../types/user.type';

// 상수
const USER_VERSION_KEY = '@user_version';
const DEBOUNCE_TIME = 1000; // 1초
const MAX_ATTEMPTS = 2;

/**
 * 버전 체크 및 업데이트를 자동으로 처리하는 훅
 * 초기 마운트와 앱 활성화될 때마다 체크 수행
 *
 * @param tokens 토큰 객체 (access_token, csrftoken)
 * @returns 버전 변경 여부 (true: 변경됨, false: 변경 없음)
 */
const useVersionCheckUpdate = (tokens: {
  access_token?: string;
  csrftoken?: string;
}) => {
  // 버전 변경 감지를 위한 상태
  const [versionChanged, setVersionChanged] = useState(false);

  // Refs for tracking check state
  const lastCheckTime = useRef<number>(0);
  const isChecking = useRef<boolean>(false);
  const initializeAttempts = useRef<number>(0);

  // 버전 체크 및 업데이트 로직
  const checkAndUpdateVersion = useCallback(async (): Promise<{
    hasChanged: boolean;
    currentVersion?: string;
    storedVersion?: string | null;
    error?: any;
  } | null> => {
    // 토큰이 유효한지 확인
    if (!tokens || !tokens.access_token || !tokens.csrftoken) {
      console.log(
        '[useVersionCheckUpdate] Skip version check - tokens not available or invalid',
        {
          hasTokens: !!tokens,
          hasAccessToken: tokens ? !!tokens.access_token : false,
          hasCsrfToken: tokens ? !!tokens.csrftoken : false,
        },
      );
      return null;
    }

    const now = Date.now();

    // 너무 빈번한 체크 방지
    if (isChecking.current || now - lastCheckTime.current < DEBOUNCE_TIME) {
      console.log(
        '[useVersionCheckUpdate] Skip version check - too frequent or already checking',
      );
      return null;
    }

    try {
      isChecking.current = true;
      console.log(
        '[useVersionCheckUpdate] Checking version... Attempt:',
        initializeAttempts.current + 1,
      );

      // API에서 최신 버전 정보 가져오기
      const meResponse = await userApis.getMe();
      console.log('[useVersionCheckUpdate] getMe API response:', meResponse);

      // 현재 버전과 저장된 버전 비교
      const currentVersion = meResponse.current_ver ?? VersionType.DEFAULT;
      const storedVersion = await AsyncStorage.getItem(USER_VERSION_KEY);
      const hasChanged = storedVersion !== currentVersion;

      if (hasChanged) {
        // 버전이 변경되었으면 저장
        await AsyncStorage.setItem(
          USER_VERSION_KEY,
          currentVersion || VersionType.DEFAULT,
        );
        console.log(
          '🔄 [useVersionCheckUpdate] Version Change Detected!\n',
          '📱 Previous Version:',
          storedVersion,
          '\n',
          '✨ New Version:',
          currentVersion,
        );

        // 버전 변경 상태 업데이트
        setVersionChanged(true);
      }

      lastCheckTime.current = Date.now();
      initializeAttempts.current = 0; // 성공하면 시도 횟수 리셋

      return {
        hasChanged,
        currentVersion,
        storedVersion,
      };
    } catch (error) {
      console.error('[useVersionCheckUpdate] Error checking version:', error);

      // 최대 시도 횟수를 초과하지 않았다면 재시도
      if (initializeAttempts.current < MAX_ATTEMPTS) {
        initializeAttempts.current += 1;
        console.log(
          '[useVersionCheckUpdate] Retrying... Attempt:',
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
  }, [tokens]);

  // Initial version check on mount when tokens are available
  useEffect(() => {
    console.log('[useVersionCheckUpdate] Initial version check');
    const initializeVersion = async () => {
      try {
        await checkAndUpdateVersion();
      } catch (error) {
        console.error(
          '[useVersionCheckUpdate] Error in version check flow:',
          error,
        );
      }
    };

    // Only run if tokens are available
    if (tokens.access_token && tokens.csrftoken) {
      initializeVersion();
    }
  }, [tokens.access_token, tokens.csrftoken, checkAndUpdateVersion]);

  // Check version each time the app becomes active
  useAppStateActiveEffect(() => {
    console.log('[useVersionCheckUpdate] Checking version on app activation');
    const checkVersionOnActive = async () => {
      try {
        await checkAndUpdateVersion();
      } catch (error) {
        console.error(
          '[useVersionCheckUpdate] Error in version check on active:',
          error,
        );
      }
    };

    // Only run if tokens are available
    if (tokens.access_token && tokens.csrftoken) {
      checkVersionOnActive();
    }
  });

  // 버전 변경 여부 반환
  return versionChanged;
};

export default useVersionCheckUpdate;
