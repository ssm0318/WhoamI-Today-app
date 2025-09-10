import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStateActiveEffect } from '@hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApis } from '@apis';
import { VersionType } from '../types/user.type';

// Constants
const USER_VERSION_KEY = '@user_version';

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

  // Return version change status
  return versionChanged;
};

export default useVersionCheckUpdate;
