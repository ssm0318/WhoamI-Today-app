import { NativeModules } from 'react-native';
import { API_URL } from '../constants/app';

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

interface FriendPostData {
  id: number;
  type: string;
  content: string;
  images: string[];
  current_user_read: boolean;
  author_username: string;
}

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
  syncFriendPost(
    postData: FriendPostData,
    authorImageBase64: string,
    postImageBase64: string,
  ): Promise<boolean>;
  clearFriendPost(): Promise<boolean>;
  syncApiBaseUrl(url: string): Promise<boolean>;
  syncVersionType(versionType: string): Promise<boolean>;
  clearAuthTokens(): Promise<boolean>;
  clearMyCheckIn(): Promise<boolean>;
  refreshWidgets(): Promise<boolean>;
  getWidgetDiagnostics(): Promise<{
    lastSeenMood: string;
    lastSeenBattery: string;
    lastFeelingDisplay: string;
    lastBatteryDisplay: string;
    lastGetTimelineAt: string;
    myCheckInJson: string;
    myCheckInRawPresent: boolean;
    myCheckInDecodeOk: boolean;
    sharedPlaylistJson: string;
    sharedPlaylistAlbumImageLen: number;
    sharedPlaylistAvatarImageLen: number;
    friendPostJson: string;
    friendPostImageLen: number;
    friendPostAuthorImageLen: number;
    albumLastGetTimelineAt: string;
    albumLastSawTrackId: string;
    albumLastSharerUsername: string;
    albumLastAlbumImageLen: number;
    albumLastAvatarImageLen: number;
    albumLastDecodeError: string;
    csrftokenLen: number;
    accessTokenLen: number;
  }>;
}

const { WidgetDataModule } = NativeModules;

export const syncTokensToWidget = async (
  csrftoken: string,
  accessToken: string,
): Promise<void> => {
  if (!WidgetDataModule) {
    console.warn('[WidgetSync] syncTokensToWidget: native module unavailable');
    return;
  }

  console.log('[WidgetSync] syncTokensToWidget called', {
    csrftokenLen: csrftoken?.length ?? 0,
    accessTokenLen: accessToken?.length ?? 0,
  });

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).syncAuthTokens(
      csrftoken,
      accessToken,
    );
    // Also sync API base URL so widget can self-fetch check-in data
    await (WidgetDataModule as WidgetDataModuleInterface).syncApiBaseUrl(
      API_URL,
    );
    console.log('[WidgetSync] syncTokensToWidget native call succeeded');
  } catch (error) {
    console.error('[WidgetSync] syncTokensToWidget FAILED:', error);
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
    // Normalize mood: API may return an array of emojis — widget expects a single string
    const normalizedMood = Array.isArray(checkIn.mood)
      ? checkIn.mood[0] ?? ''
      : checkIn.mood;

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

    await (WidgetDataModule as WidgetDataModuleInterface).syncMyCheckIn(
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
  if (!WidgetDataModule) return;

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).clearMyCheckIn();
  } catch (error) {
    console.error('Failed to clear MyCheckIn from widget:', error);
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
  if (!WidgetDataModule) {
    console.warn('[WidgetSync] WidgetDataModule native module not available');
    return;
  }

  console.log('[WidgetSync] syncSharedPlaylistTrackToWidget called with:', {
    id: track.id,
    trackId: track.trackId,
    sharerUsername: track.sharerUsername,
    hasAlbumImageUrl: !!track.albumImageUrl,
    albumImageBase64Len: albumImageBase64.length,
    avatarImageBase64Len: avatarImageBase64.length,
  });

  try {
    const trackData: SharedPlaylistTrackData = {
      id: track.id,
      track_id: track.trackId,
      album_image_url: track.albumImageUrl,
      sharer_username: track.sharerUsername,
      sharer_profile_image_url: track.sharerProfileImageUrl,
    };

    await (
      WidgetDataModule as WidgetDataModuleInterface
    ).syncSharedPlaylistTrack(trackData, albumImageBase64, avatarImageBase64);
    console.log(
      `[WidgetSync] syncSharedPlaylistTrack native call succeeded (sharer='${track.sharerUsername}')`,
    );
  } catch (error) {
    console.error(
      '[WidgetSync] syncSharedPlaylistTrack native call FAILED:',
      error,
    );
  }
};

export const clearSharedPlaylistTrackFromWidget = async (): Promise<void> => {
  if (!WidgetDataModule) return;

  try {
    await (
      WidgetDataModule as WidgetDataModuleInterface
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
} | null> => {
  if (!WidgetDataModule) {
    console.warn('[WidgetSync] getWidgetDiagnostics: WidgetDataModule is null');
    return null;
  }
  try {
    const diagResult = await (
      WidgetDataModule as WidgetDataModuleInterface
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
        checkin_myCheckInJsonLen: diag.myCheckInJson?.length ?? 0,
        checkin_myCheckInJsonPreview: diag.myCheckInJson?.slice(0, 200) ?? '',
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
  if (!WidgetDataModule) {
    console.warn('WidgetDataModule not available');
    return;
  }

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).syncVersionType(
      versionType,
    );
    console.log(`[WidgetBridge] Version type synced to widget: ${versionType}`);
  } catch (error) {
    console.error('Failed to sync version type to widget:', error);
  }
};

export const syncFriendPostToWidget = async (
  post: {
    id: number;
    type: string;
    content: string;
    images: string[];
    currentUserRead: boolean;
    authorUsername: string;
  },
  authorImageBase64: string,
  postImageBase64: string,
): Promise<void> => {
  if (!WidgetDataModule) {
    console.warn('[WidgetSync] WidgetDataModule native module not available');
    return;
  }

  console.log('[WidgetSync] syncFriendPostToWidget called with:', {
    id: post.id,
    type: post.type,
    contentLen: post.content?.length ?? 0,
    imagesCount: post.images?.length ?? 0,
    currentUserRead: post.currentUserRead,
    authorUsername: post.authorUsername,
    authorImageBase64Len: authorImageBase64.length,
    postImageBase64Len: postImageBase64.length,
  });

  try {
    const postData: FriendPostData = {
      id: post.id,
      type: post.type,
      content: post.content,
      images: post.images,
      current_user_read: post.currentUserRead,
      author_username: post.authorUsername,
    };

    await (WidgetDataModule as WidgetDataModuleInterface).syncFriendPost(
      postData,
      authorImageBase64,
      postImageBase64,
    );
    console.log(
      `[WidgetSync] syncFriendPost native call succeeded (author='${post.authorUsername}')`,
    );
  } catch (error) {
    console.error('[WidgetSync] syncFriendPost native call FAILED:', error);
  }
};

export const clearFriendPostFromWidget = async (): Promise<void> => {
  if (!WidgetDataModule) return;

  try {
    await (WidgetDataModule as WidgetDataModuleInterface).clearFriendPost();
  } catch (error) {
    console.error('Failed to clear friend post from widget:', error);
  }
};
