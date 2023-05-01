import { useEffect, DependencyList } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 *  The passed callback should be wrapped in `React.useCallback` to avoid running the effect too often.
 */
const useAppStateEffect = (
  effect: (state: AppStateStatus) => void,
  deps: DependencyList,
) => {
  useEffect(() => {
    const { remove } = AppState.addEventListener('change', effect);
    return () => remove();
  }, [deps, effect]);
};

export default useAppStateEffect;
