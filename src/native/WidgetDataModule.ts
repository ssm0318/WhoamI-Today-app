import { NativeModules } from 'react-native';
import { API_URL } from '../constants/app';
import { normalizeMoodForWidget } from '../utils/widgetCheckInNormalize';

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

interface SharedPlaylistTrackData {
  id: number;
  track_id: string;
  album_image_url: string | null;
  sharer_username: string;
  sharer_profile_image_url: string | null;
}

export type FriendUpdatePayload =
  | {
      kind: 'post';
      friend: { username: string };
      post: { id: number; content: string; has_image: boolean };
    }
  | {
      kind: 'checkin';
      friend: { username: string };
      checkin: {
        variation: 'album' | 'mood' | 'social_battery' | 'thought';
        mood?: string;
        social_battery?: string | null;
        description?: string;
        track_id?: string;
      };
    };

interface WidgetDataModuleInterface {
  syncAuthTokens(csrftoken: string, accessToken: string): Promise<boolean>;
  syncSpotifyCredentials(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean>;
  syncMyCheckIn(
    checkInData: MyCheckInData,
    albumImageBase64: string,
  ): Promise<boolean>;
  syncSharedPlaylistTrack(
    trackData: SharedPlaylistTrackData,
    albumImageBase64: string,
    avatarImageBase64: string,
  ): Promise<boolean>;
  clearSharedPlaylistTrack(): Promise<boolean>;
  syncFriendUpdate(
    payload: FriendUpdatePayload,
    profileImageBase64: string,
    contentImageBase64: string,
  ): Promise<boolean>;
  clearFriendUpdate(): Promise<boolean>;
  syncApiBaseUrl(url: string): Promise<boolean>;
  syncVersionType(versionType: string): Promise<boolean>;
  clearAuthTokens(): Promise<boolean>;
  clearMyCheckIn(): Promise<boolean>;
  clearAllWidgetData(): Promise<boolean>;
  refreshWidgets(): Promise<boolean>;
  getWidgetDiagnostics(): Promise<{
    lastSeenMood: string;
    lastSeenBattery: string;
    lastFeelingDisplay: string;
    lastBatteryDisplay: string;
    lastGetTimelineAt: string;
    myCheckInJson: string;
    myCheckInJsonFile: string;
    myCheckInRawPresent: boolean;
    myCheckInDecodeOk: boolean;
    widgetHeartbeat: string;
    sharedPlaylistJson: string;
    sharedPlaylistAlbumImageLen: number;
    sharedPlaylistAvatarImageLen: number;
    friendUpdateJson: string;
    friendUpdateJsonFile: string;
    friendUpdateContentImageLen: number;
    friendUpdateProfileImageLen: number;
    friendUpdateContentImageFileLen: number;
    friendUpdateProfileImageFileLen: number;
    albumLastGetTimelineAt: string;
    albumLastSawTrackId: string;
    albumLastSharerUsername: string;
    albumLastAlbumImageLen: number;
    albumLastAvatarImageLen: number;
    albumLastDecodeError: string;
    csrftokenLen: number;
    accessTokenLen: number;
    csrftokenFileLen: number;
    accessTokenFileLen: number;
    apiBaseUrl: string;
    apiBaseUrlFile: string;
  }>;
}

/** Lazy read — do not touch NativeModules at module load (imported from App.tsx). */
const getWidgetNativeModule = (): WidgetDataModuleInterface | undefined =>
  NativeModules.WidgetDataModule as WidgetDataModuleInterface | undefined;

export const syncTokensToWidget = async (
  csrftoken: string,
  accessToken: string,
): Promise<void> => {
  if (!getWidgetNativeModule()) {
    console.warn('[WidgetSync] syncTokensToWidget: native module unavailable');
    return;
  }

  console.log('[WidgetSync] syncTokensToWidget called', {
    csrftokenLen: csrftoken?.length ?? 0,
    accessTokenLen: accessToken?.length ?? 0,
  });

  try {
    await (getWidgetNativeModule() as WidgetDataModuleInterface).syncAuthTokens(
      csrftoken,
      accessToken,
    );
    // Also sync API base URL so widget can self-fetch check-in data
    await (getWidgetNativeModule() as WidgetDataModuleInterface).syncApiBaseUrl(
      API_URL,
    );
    console.log('[WidgetSync] syncTokensToWidget native call succeeded');
  } catch (error) {
    console.error('[WidgetSync] syncTokensToWidget FAILED:', error);
  }
};

export const clearWidgetTokens = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).clearAuthTokens();
  } catch (error) {
    console.error('Failed to clear widget tokens:', error);
  }
};

export const triggerWidgetRefresh = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).refreshWidgets();
  } catch (error) {
    console.error('Failed to refresh widgets:', error);
  }
};

export const syncSpotifyCredentialsToWidget = async (
  clientId: string,
  clientSecret: string,
): Promise<void> => {
  if (!getWidgetNativeModule()) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
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
  if (!getWidgetNativeModule()) {
    console.warn('[WidgetSync] WidgetDataModule native module not available');
    return;
  }

  console.log('[WidgetSync] syncMyCheckInToWidget called with:', {
    id: checkIn.id,
    isActive: checkIn.isActive,
    mood: checkIn.mood,
    socialBattery: checkIn.socialBattery,
    descriptionLen: checkIn.description?.length ?? 0,
    descriptionPreview: checkIn.description?.slice(0, 30) ?? '',
    trackId: checkIn.trackId,
    hasAlbumImageUrl: !!checkIn.albumImageUrl,
  });

  try {
    const normalizedMood = normalizeMoodForWidget(checkIn.mood);

    // Convert to snake_case for iOS native module
    const checkInData: MyCheckInData = {
      id: checkIn.id,
      is_active: checkIn.isActive,
      created_at: checkIn.createdAt,
      mood: normalizedMood,
      social_battery: checkIn.socialBattery,
      description: checkIn.description,
      track_id: checkIn.trackId,
      album_image_url: checkIn.albumImageUrl,
    };

    // Fetch album image as base64 so the widget has it immediately
    let albumImageBase64 = '';
    if (checkIn.albumImageUrl) {
      try {
        const response = await fetch(checkIn.albumImageUrl);
        const blob = await response.blob();
        albumImageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] || '');
          };
          reader.readAsDataURL(blob);
        });
        console.log(
          `[WidgetSync] Check-in album image fetched: ${albumImageBase64.length} base64 chars`,
        );
      } catch (imgError) {
        console.warn(
          '[WidgetSync] Failed to fetch check-in album image:',
          imgError,
        );
      }
    }

    await (getWidgetNativeModule() as WidgetDataModuleInterface).syncMyCheckIn(
      checkInData,
      albumImageBase64,
    );
    console.log(
      `[WidgetSync] syncMyCheckIn native call succeeded (mood='${
        checkIn.mood
      }', desc='${(checkIn.description ?? '').slice(0, 30)}', albumImg=${
        albumImageBase64.length
      })`,
    );
  } catch (error) {
    console.error('[WidgetSync] syncMyCheckIn native call FAILED:', error);
  }
};

export const clearMyCheckInFromWidget = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).clearMyCheckIn();
  } catch (error) {
    console.error('Failed to clear MyCheckIn from widget:', error);
  }
};

export const clearAllWidgetDataForLogout = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).clearAllWidgetData();
  } catch (error) {
    console.error('Failed to clear all widget data for logout:', error);
  }
};

export const syncSharedPlaylistTrackToWidget = async (
  track: {
    id: number;
    trackId: string;
    albumImageUrl: string | null;
    sharerUsername: string;
    sharerProfileImageUrl: string | null;
  },
  albumImageBase64: string,
  avatarImageBase64: string,
): Promise<void> => {
  if (!getWidgetNativeModule()) {
    console.warn(
      '[WidgetSync][SharedSync][native-module-unavailable] WidgetDataModule missing',
    );
    return;
  }

  console.log('[WidgetSync][SharedSync][prepare]', {
    id: track.id,
    trackId: track.trackId,
    sharerUsername: track.sharerUsername,
    hasAlbumImageUrl: !!track.albumImageUrl,
    albumImageBase64Len: albumImageBase64.length,
    avatarImageBase64Len: avatarImageBase64.length,
  });

  try {
    console.log('[WidgetSync][SharedSync][build-payload]', {
      hasTrackId: !!track.trackId,
      hasAlbumImageUrl: !!track.albumImageUrl,
      hasSharerProfileImageUrl: !!track.sharerProfileImageUrl,
    });
    const trackData: SharedPlaylistTrackData = {
      id: track.id,
      track_id: track.trackId,
      album_image_url: track.albumImageUrl,
      sharer_username: track.sharerUsername,
      sharer_profile_image_url: track.sharerProfileImageUrl,
    };

    console.log('[WidgetSync][SharedSync][native-call-start]', {
      trackId: track.trackId,
      sharerUsername: track.sharerUsername,
    });
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).syncSharedPlaylistTrack(trackData, albumImageBase64, avatarImageBase64);
    console.log('[WidgetSync][SharedSync][native-call-success]', {
      trackId: track.trackId,
      sharerUsername: track.sharerUsername,
    });
  } catch (error) {
    console.error('[WidgetSync][SharedSync][native-call-failed]', {
      trackId: track.trackId,
      sharerUsername: track.sharerUsername,
      error,
    });
  }
};

export const clearSharedPlaylistTrackFromWidget = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).clearSharedPlaylistTrack();
  } catch (error) {
    console.error('Failed to clear shared playlist track from widget:', error);
  }
};

export const getWidgetDiagnostics = async (): Promise<{
  lastSeenMood: string;
  lastSeenBattery: string;
  lastFeelingDisplay: string;
  lastBatteryDisplay: string;
  lastGetTimelineAt: string;
  myCheckInJson: string;
  myCheckInJsonFile?: string;
} | null> => {
  if (!getWidgetNativeModule()) {
    console.warn('[WidgetSync] getWidgetDiagnostics: WidgetDataModule is null');
    return null;
  }
  try {
    const diagResult = await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).getWidgetDiagnostics();

    // Android returns a JSON string, iOS returns an object
    let diag: any;
    if (typeof diagResult === 'string') {
      // Android: parse JSON string
      try {
        diag = JSON.parse(diagResult);
        console.log('[WidgetSync] Android diagnostics (parsed from JSON):', {
          auth_csrftokenLen: diag.csrftokenLen ?? 0,
          auth_accessTokenLen: diag.accessTokenLen ?? 0,
          userVersionType: diag.userVersionType ?? '',
          widgetDataJsonLen: diag.widgetDataJsonLen ?? 0,
          myCheckInRawPresent: diag.myCheckInRawPresent ?? false,
          myCheckInDecodeOk: diag.myCheckInDecodeOk ?? false,
          lastSeenMood: diag.lastSeenMood ?? '',
          lastSeenBattery: diag.lastSeenBattery ?? '',
          lastSeenDescription: diag.lastSeenDescription ?? '',
          lastSeenTrackId: diag.lastSeenTrackId ?? '',
          lastSeenAlbumImageUrl: diag.lastSeenAlbumImageUrl ?? '',
          spotifyClientIdLen: diag.spotifyClientIdLen ?? 0,
          spotifyClientSecretLen: diag.spotifyClientSecretLen ?? 0,
          allPrefsKeys: diag.allPrefsKeys ?? [],
          widgetDataJson: diag.widgetDataJson ?? '{}',
        });
      } catch (parseError) {
        console.error(
          '[WidgetSync] Failed to parse Android diagnostics JSON:',
          parseError,
        );
        return null;
      }
    } else {
      // iOS: use object directly
      diag = diagResult;
      console.log('[WidgetSync] iOS App Group state read by widget:', {
        // ── Auth tokens (must be >0 or widgets render SignInView) ──
        auth_csrftokenLen: diag.csrftokenLen ?? 'undefined-OLD-BRIDGE',
        auth_accessTokenLen: diag.accessTokenLen ?? 'undefined-OLD-BRIDGE',
        auth_csrftokenFileLen: diag.csrftokenFileLen ?? 'undefined-OLD-BRIDGE',
        auth_accessTokenFileLen:
          diag.accessTokenFileLen ?? 'undefined-OLD-BRIDGE',
        apiBaseUrl: diag.apiBaseUrl ?? 'undefined-OLD-BRIDGE',
        apiBaseUrlFile: diag.apiBaseUrlFile ?? 'undefined-OLD-BRIDGE',
        // ── CheckinWidget ──
        checkin_lastGetTimelineAt: diag.lastGetTimelineAt,
        checkin_lastSeenMood: diag.lastSeenMood,
        checkin_lastSeenBattery: diag.lastSeenBattery,
        checkin_lastFeelingDisplay: diag.lastFeelingDisplay,
        checkin_lastBatteryDisplay: diag.lastBatteryDisplay,
        checkin_myCheckInRawPresent:
          diag.myCheckInRawPresent ?? 'undefined-OLD-BRIDGE',
        checkin_myCheckInDecodeOk:
          diag.myCheckInDecodeOk ?? 'undefined-OLD-BRIDGE',
        checkin_myCheckInDecodeSource:
          diag.myCheckInDecodeSource ?? 'undefined-OLD-BRIDGE',
        checkin_myCheckInJsonLen: diag.myCheckInJson?.length ?? 0,
        checkin_myCheckInJsonPreview: diag.myCheckInJson?.slice(0, 200) ?? '',
        checkin_myCheckInJsonFileLen: diag.myCheckInJsonFile?.length ?? 0,
        checkin_myCheckInJsonFilePreview:
          diag.myCheckInJsonFile?.slice(0, 200) ?? '',
        checkin_myCheckInRawPreview: diag.myCheckInRawPreview ?? '',
        widgetHeartbeat: diag.widgetHeartbeat ?? 'undefined-OLD-BRIDGE',
        // ── AlbumCoverWidget ──
        album_lastGetTimelineAt:
          diag.albumLastGetTimelineAt ?? 'undefined-OLD-BRIDGE',
        album_lastSawTrackId:
          diag.albumLastSawTrackId ?? 'undefined-OLD-BRIDGE',
        album_lastSharerUsername:
          diag.albumLastSharerUsername ?? 'undefined-OLD-BRIDGE',
        album_lastAlbumImageLen: diag.albumLastAlbumImageLen ?? 'undefined',
        album_lastAvatarImageLen: diag.albumLastAvatarImageLen ?? 'undefined',
        album_lastDecodeError:
          diag.albumLastDecodeError ?? 'undefined-OLD-BRIDGE',
        // ── Source of truth: what's currently in App Group right now ──
        sharedPlaylistJsonLen: diag.sharedPlaylistJson?.length ?? 0,
        sharedPlaylistJsonPreview: diag.sharedPlaylistJson?.slice(0, 200) ?? '',
        sharedPlaylistAlbumImageLen:
          diag.sharedPlaylistAlbumImageLen ?? 'undefined',
        sharedPlaylistAvatarImageLen:
          diag.sharedPlaylistAvatarImageLen ?? 'undefined',
        friendUpdate_jsonLen: diag.friendUpdateJson?.length ?? 0,
        friendUpdate_jsonPreview: diag.friendUpdateJson?.slice(0, 200) ?? '',
        friendUpdate_jsonFileLen: diag.friendUpdateJsonFile?.length ?? 0,
        friendUpdate_jsonFilePreview:
          diag.friendUpdateJsonFile?.slice(0, 200) ?? '',
        friendUpdate_contentImageLen:
          diag.friendUpdateContentImageLen ?? 'undefined',
        friendUpdate_profileImageLen:
          diag.friendUpdateProfileImageLen ?? 'undefined',
        friendUpdate_contentImageFileLen:
          diag.friendUpdateContentImageFileLen ?? 'undefined',
        friendUpdate_profileImageFileLen:
          diag.friendUpdateProfileImageFileLen ?? 'undefined',
        photoWidget_lastRenderAt: diag.photoWidgetLastRenderAt ?? '(never)',
        photoWidget_lastRenderDiag: diag.photoWidgetLastRenderDiag ?? '(never)',
      });
    }
    return diag;
  } catch (e) {
    console.warn('[WidgetSync] getWidgetDiagnostics failed:', e);
    return null;
  }
};

export const syncVersionTypeToWidget = async (
  versionType: string,
): Promise<void> => {
  if (!getWidgetNativeModule()) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).syncVersionType(versionType);
    console.log(`[WidgetBridge] Version type synced to widget: ${versionType}`);
  } catch (error) {
    console.error('Failed to sync version type to widget:', error);
  }
};

export const syncFriendUpdateToWidget = async (
  payload: FriendUpdatePayload,
  profileImageBase64: string,
  contentImageBase64: string,
): Promise<void> => {
  if (!getWidgetNativeModule()) {
    console.warn('[WidgetSync] WidgetDataModule native module not available');
    return;
  }

  console.log('[WidgetSync] syncFriendUpdateToWidget called with:', {
    kind: payload.kind,
    username: payload.friend.username,
    variation:
      payload.kind === 'checkin' ? payload.checkin.variation : undefined,
    hasProfileImage: !!profileImageBase64,
    hasContentImage: !!contentImageBase64,
  });

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).syncFriendUpdate(payload, profileImageBase64, contentImageBase64);
    console.log(
      `[WidgetSync] syncFriendUpdate native call succeeded (kind='${payload.kind}', user='${payload.friend.username}')`,
    );
  } catch (error) {
    console.error('[WidgetSync] syncFriendUpdate native call FAILED:', error);
  }
};

export const clearFriendUpdateFromWidget = async (): Promise<void> => {
  if (!getWidgetNativeModule()) return;

  try {
    await (
      getWidgetNativeModule() as WidgetDataModuleInterface
    ).clearFriendUpdate();
  } catch (error) {
    console.error('Failed to clear friend update from widget:', error);
  }
};
