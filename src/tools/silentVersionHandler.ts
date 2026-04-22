import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  syncVersionTypeToWidget,
  triggerWidgetRefresh,
} from '../native/WidgetDataModule';
import {
  USER_VERSION_KEY,
  triggerVersionCheck,
} from '../hooks/useVersionCheckUpdate';

/**
 * Shape of the data payload in a FCM silent push with type=version_change.
 */
export interface SilentVersionChangeData {
  type?: string;
  new_ver?: string;
  ver_changed_at?: string;
}

/**
 * Apply a silent `version_change` push on the device.
 *
 * Runs in both the RN background-message handler (app suspended) and the
 * foreground `onMessage` path. Must complete quickly — iOS gives roughly
 * 25 seconds before killing the handler. No network calls here; a full
 * `checkAndUpdateVersion` runs on the next hook emission when a React
 * consumer is mounted.
 */
export const handleSilentVersionChange = async (
  data: SilentVersionChangeData | undefined,
): Promise<void> => {
  const newVer = data?.new_ver;
  if (!newVer) {
    console.warn(
      '[silentVersionHandler] Ignoring version_change push without new_ver',
      data,
    );
    return;
  }

  console.log('[silentVersionHandler] Applying version_change', {
    newVer,
    verChangedAt: data?.ver_changed_at ?? '(unset)',
  });

  try {
    await AsyncStorage.setItem(USER_VERSION_KEY, newVer);
  } catch (error) {
    console.error(
      '[silentVersionHandler] Failed to persist user_version to AsyncStorage:',
      error,
    );
  }

  try {
    await syncVersionTypeToWidget(newVer);
  } catch (error) {
    console.error(
      '[silentVersionHandler] Failed to sync version to widget App Group:',
      error,
    );
  }

  try {
    await triggerWidgetRefresh();
  } catch (error) {
    console.error(
      '[silentVersionHandler] Failed to refresh widget timelines:',
      error,
    );
  }

  // Notify any mounted React consumer so the WebView reload path runs.
  // No-op if the app is suspended.
  triggerVersionCheck();
};
