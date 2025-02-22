import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { sessionApis } from '@apis';

const useSession = () => {
  const appState = useRef(AppState.currentState);
  const pingInterval = useRef<NodeJS.Timeout>();

  const startPingInterval = () => {
    // 1분마다 ping 보내기
    pingInterval.current = setInterval(() => {
      sessionApis.sendPing().catch((error: Error) => {
        console.error('Failed to send ping:', error);
      });
    }, 60000); // 60초 = 1분
  };

  const stopPingInterval = () => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = undefined;
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // 앱이 foreground로 돌아옴
      try {
        await sessionApis.startSession();
        startPingInterval();
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    } else if (
      appState.current === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      // 앱이 background로 감
      try {
        stopPingInterval();
        await sessionApis.endSession();
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
    appState.current = nextAppState;
  };

  useEffect(() => {
    // 앱 시작시 세션 시작
    sessionApis
      .startSession()
      .then(() => {
        startPingInterval();
      })
      .catch((error: Error) => {
        console.error('Failed to start initial session:', error);
      });

    // AppState 변경 이벤트 리스너 등록
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      // 클린업: 앱 종료시 세션 종료 및 리소스 정리
      stopPingInterval();
      subscription.remove();
      sessionApis.endSession().catch((error: Error) => {
        console.error('Failed to end session on cleanup:', error);
      });
    };
  }, []);
};

export default useSession;
