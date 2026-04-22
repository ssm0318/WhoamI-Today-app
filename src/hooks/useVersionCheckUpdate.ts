import { useEffect, useRef, useState, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAppStateActiveEffect } from '@hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApis } from '@apis';
import { VersionType } from '../types/user.type';
import { syncVersionTypeToWidget } from '../native/WidgetDataModule';

// Constants
export const USER_VERSION_KEY = '@user_version';
export const VERSION_CHECK_EVENT = 'version:check-requested';

/**
 * Trigger a version check from outside the React tree (e.g. Firebase
 * background message handler). The hook's internal listener will pick
 * this up and call checkAndUpdateVersion if a mounted consumer exists.
 * If no consumer is mounted, it's a no-op — the mount-time check will
 * catch up when the app is re-opened.
 */
export const triggerVersionCheck = (): void => {
  DeviceEventEmitter.emit(VERSION_CHECK_EVENT);
};

/**
 * Hook that automatically handles version check and update
 * Performs check on initial mount and whenever app becomes active
 *
 * @param tokens Token object (access_token, csrftoken)
 * @returns Version change status (true: changed, false: no change)
 */
const useVersionCheckUpdate = (tokens: {
  access_token?: string;
  csrftoken?: string;
}) => {
  // State for detecting version changes
  const [versionChanged, setVersionChanged] = useState(false);

  // Ref for tracking check state
  const isChecking = useRef<boolean>(false);

  // Version check and update logic
  const checkAndUpdateVersion = useCallback(async (): Promise<{
    hasChanged: boolean;
    currentVersion?: string;
    storedVersion?: string | null;
    error?: any;
  } | null> => {
    // Check if tokens are valid
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

    // Prevent if already checking
    if (isChecking.current) {
      console.log(
        '[useVersionCheckUpdate] Skip version check - already checking',
      );
      return null;
    }

    try {
      isChecking.current = true;
      console.log('[useVersionCheckUpdate] Checking version...');

      // Get latest version information from API
      const meResponse = await userApis.getMe();
      console.log('[useVersionCheckUpdate] getMe API response:', meResponse);

      // Compare current version with stored version
      const currentVersion = meResponse.current_ver ?? VersionType.DEFAULT;
      const storedVersion = await AsyncStorage.getItem(USER_VERSION_KEY);
      const hasChanged = storedVersion !== currentVersion;

      if (hasChanged) {
        // Save if version has changed
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

        // Update version change state
        setVersionChanged(true);
      }

      // Sync version type to native widgets (always sync, not just on change)
      await syncVersionTypeToWidget(currentVersion || VersionType.DEFAULT);

      return {
        hasChanged,
        currentVersion,
        storedVersion,
      };
    } catch (error) {
      console.error('[useVersionCheckUpdate] Error checking version:', error);
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

  // Check version every time the app becomes active. No throttling — the
  // isChecking ref inside checkAndUpdateVersion already collapses overlapping
  // calls, so rapid background/foreground toggles can't stack requests.
  useAppStateActiveEffect(() => {
    if (!tokens.access_token || !tokens.csrftoken) return;

    console.log('[useVersionCheckUpdate] Checking version on app activation');
    checkAndUpdateVersion().catch((error) => {
      console.error(
        '[useVersionCheckUpdate] Error in version check on active:',
        error,
      );
    });
  });

  // Subscribe to external trigger events (e.g. from FCM silent push handler)
  // so the foreground app immediately re-verifies the current version. The
  // isChecking ref collapses overlap with any concurrent check in flight.
  useEffect(() => {
    if (!tokens.access_token || !tokens.csrftoken) return;

    const subscription = DeviceEventEmitter.addListener(
      VERSION_CHECK_EVENT,
      () => {
        console.log(
          '[useVersionCheckUpdate] External trigger received - checking version',
        );
        checkAndUpdateVersion().catch((error) => {
          console.error(
            '[useVersionCheckUpdate] Error in externally triggered check:',
            error,
          );
        });
      },
    );

    return () => {
      subscription.remove();
    };
  }, [tokens.access_token, tokens.csrftoken, checkAndUpdateVersion]);

  // Return version change status
  return versionChanged;
};

export default useVersionCheckUpdate;
