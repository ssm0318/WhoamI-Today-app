import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 *  The passed callback should be wrapped in `React.useCallback` to avoid running the effect too often.
 * Special useEffect for when app returns to active state
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
