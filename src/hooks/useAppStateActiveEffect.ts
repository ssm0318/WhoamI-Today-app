import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 *  The passed callback should be wrapped in `React.useCallback` to avoid running the effect too often.
 * 앱이 active 상태로 돌아올때의 특수한 useEffect
 */
const useAppStateActiveEffect = <T extends () => Promise<void> | void>(
  effect: T,
  runOnMount = true,
) => {
  useEffect(() => {
    if (runOnMount) effect();
    const { remove } = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      effect();
    });
    return () => {
      remove();
    };
  }, [effect, runOnMount]);
};

export default useAppStateActiveEffect;
