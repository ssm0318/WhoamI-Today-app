import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { sessionApis } from '@apis';
import { CookieStorage } from '@tools';
import { useAppStateEffect } from '@hooks';

const useSession = () => {
  const touchInterval = useRef<NodeJS.Timeout>();
  const isAuthenticatedRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isAuthenticated = async (): Promise<boolean> => {
    const { access_token, csrftoken } = await CookieStorage.getCookie();
    return !!(access_token && csrftoken);
  };

  const startSessionIfAuthenticated = useCallback(async () => {
    const authenticated = await isAuthenticated();
    isAuthenticatedRef.current = authenticated;

    if (authenticated) {
      console.log('🚀 Initializing session...');
      try {
        await sessionApis.startSession();
        console.log('✅ Session started successfully');
        startTouchInterval();
      } catch (error) {
        console.error('❌ Failed to start session:', error);
      }
    } else {
      console.log(
        '🔒 No access token or csrf token found, skipping session start',
      );
    }
  }, []);

  const endSession = useCallback(async () => {
    if (isAuthenticatedRef.current) {
      console.log('💤 App going to background, ending session...');
      try {
        stopTouchInterval();
        await sessionApis.endSession();
        console.log('👋 Session ended successfully');
      } catch (error) {
        console.error('❌ Failed to end session:', error);
      }
    }
  }, []);

  const startTouchInterval = () => {
    // 이미 interval이 실행 중이면 중복 실행 방지
    if (touchInterval.current) {
      return;
    }

    // 1분마다 touch 보내기
    touchInterval.current = setInterval(async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        console.log(
          '🔒 No access token or csrf token found, stopping touch interval',
        );
        stopTouchInterval();
        return;
      }

      sessionApis
        .sendTouch()
        .then(() => console.log('🟢 Session touch sent'))
        .catch((error: Error) => {
          console.error('🔴 Failed to send touch:', error);
        });
    }, 60000);
  };

  const stopTouchInterval = () => {
    if (touchInterval.current) {
      clearInterval(touchInterval.current);
      touchInterval.current = undefined;
    }
  };

  // 앱 상태 변화 처리
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      console.log(
        `🔄 App state changed from ${appStateRef.current} to ${nextAppState}`,
      );

      // 앱이 백그라운드/비활성화에서 포그라운드/활성화로 전환
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground, checking authentication...');
        await startSessionIfAuthenticated();
      }
      // 앱이 포그라운드/활성화에서 백그라운드/비활성화로 전환
      else if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        await endSession();
      }

      appStateRef.current = nextAppState;
    },
    [startSessionIfAuthenticated, endSession],
  );

  // AppState 변화 감지
  useAppStateEffect(handleAppStateChange, [handleAppStateChange]);

  // 초기 설정 및 정리
  useEffect(() => {
    // 앱 시작 시 세션 초기화
    startSessionIfAuthenticated();

    return () => {
      console.log('🧹 Cleaning up session...');
      stopTouchInterval();
      if (isAuthenticatedRef.current) {
        sessionApis
          .endSession()
          .then(() => console.log('👋 Session cleanup completed'))
          .catch((error: Error) => {
            console.error('❌ Failed to end session on cleanup:', error);
          });
      }
    };
  }, [startSessionIfAuthenticated]);
};

export default useSession;
