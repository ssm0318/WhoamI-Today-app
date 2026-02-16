import { NativeModules } from 'react-native';

interface MyCheckInData {
  id: number;
  is_active: boolean;
  created_at: string;
  mood: string;
  social_battery: string | null;
  description: string;
  track_id: string;
  album_image_url: string | null;
}

interface WidgetDataModuleInterface {
  syncAuthTokens(csrftoken: string, accessToken: string): Promise<boolean>;
  syncSpotifyCredentials(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean>;
  syncMyCheckIn(checkInData: MyCheckInData): Promise<boolean>;
  clearAuthTokens(): Promise<boolean>;
  clearMyCheckIn(): Promise<boolean>;
  refreshWidgets(): Promise<boolean>;
  getWidgetDiagnostics(): Promise<{
    lastSeenMood: string;
    lastGetTimelineAt: string;
  }>;
}

const { WidgetDataModule } = NativeModules;

export const syncTokensToWidget = async (
  csrftoken: string,
  accessToken: string,
): Promise<void> => {
  if (!WidgetDataModule) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).syncAuthTokens(
      csrftoken,
      accessToken,
    );
  } catch (error) {
    console.error('Failed to sync tokens to widget:', error);
  }
};

export const clearWidgetTokens = async (): Promise<void> => {
  if (!WidgetDataModule) return;

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).clearAuthTokens();
  } catch (error) {
    console.error('Failed to clear widget tokens:', error);
  }
};

export const triggerWidgetRefresh = async (): Promise<void> => {
  if (!WidgetDataModule) return;

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).refreshWidgets();
  } catch (error) {
    console.error('Failed to refresh widgets:', error);
  }
};

export const syncSpotifyCredentialsToWidget = async (
  clientId: string,
  clientSecret: string,
): Promise<void> => {
  if (!WidgetDataModule) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    await (
      WidgetDataModule as WidgetDataModuleInterface
    ).syncSpotifyCredentials(clientId, clientSecret);
  } catch (error) {
    console.error('Failed to sync Spotify credentials to widget:', error);
  }
};

export const syncMyCheckInToWidget = async (checkIn: {
  id: number;
  isActive: boolean;
  createdAt: string;
  mood: string;
  socialBattery: string | null;
  description: string;
  trackId: string;
  albumImageUrl: string | null;
}): Promise<void> => {
  if (!WidgetDataModule) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    // Convert to snake_case for iOS native module
    const checkInData: MyCheckInData = {
      id: checkIn.id,
      is_active: checkIn.isActive,
      created_at: checkIn.createdAt,
      mood: checkIn.mood,
      social_battery: checkIn.socialBattery,
      description: checkIn.description,
      track_id: checkIn.trackId,
      album_image_url: checkIn.albumImageUrl,
    };

    await (WidgetDataModule as WidgetDataModuleInterface).syncMyCheckIn(
      checkInData,
    );
    console.log(
      `[WidgetBridge] MyCheckIn synced to widget successfully, mood: ${checkIn.mood}`,
    );
  } catch (error) {
    console.error('Failed to sync MyCheckIn to widget:', error);
  }
};

export const clearMyCheckInFromWidget = async (): Promise<void> => {
  if (!WidgetDataModule) return;

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).clearMyCheckIn();
  } catch (error) {
    console.error('Failed to clear MyCheckIn from widget:', error);
  }
};

export const getWidgetDiagnostics = async (): Promise<{
  lastSeenMood: string;
  lastGetTimelineAt: string;
} | null> => {
  if (!WidgetDataModule) {
    console.warn(
      '[WidgetDataModule] getWidgetDiagnostics: WidgetDataModule is null',
    );
    return null;
  }
  try {
    return await (
      WidgetDataModule as WidgetDataModuleInterface
    ).getWidgetDiagnostics();
  } catch (e) {
    console.warn('[WidgetDataModule] getWidgetDiagnostics failed:', e);
    return null;
  }
};
