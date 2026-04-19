#import "WidgetDataModule.h"

@implementation WidgetDataModule

RCT_EXPORT_MODULE();

static NSArray *kWidgetKinds = nil;

+ (void)initialize {
    if (self == [WidgetDataModule class]) {
        kWidgetKinds = @[
            @"WhoAmITodayWidget",
            @"PhotoWidget",
            // V2 kinds — old "AlbumCoverWidget" / "CheckinWidget" kinds were bumped
            // to force iOS to discard cached snapshots for stale widget instances.
            @"AlbumCoverWidgetV2",
            @"CheckinWidgetV2"
        ];
    }
}

- (void)reloadWidgetTimelines {
    if (@available(iOS 14.0, *)) {
        Class WidgetCenterClass = NSClassFromString(@"WidgetCenter");
        if (WidgetCenterClass) {
            id sharedCenter = [WidgetCenterClass performSelector:@selector(shared)];
            if (sharedCenter) {
                [sharedCenter performSelector:@selector(reloadAllTimelines)];
                if (@available(iOS 15.0, *)) {
                    SEL reloadKind = NSSelectorFromString(@"reloadTimelinesOfKind:");
                    if ([sharedCenter respondsToSelector:reloadKind]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
                        for (NSString *kind in kWidgetKinds) {
                            [sharedCenter performSelector:reloadKind withObject:kind];
                        }
#pragma clang diagnostic pop
                    }
                }
            }
        }
    }
}

// Reload now and again after a short delay so the widget extension picks up App Group data after user has switched to home screen
- (void)reloadWidgetTimelinesWithFollowUp {
    [self reloadWidgetTimelines];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.8 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self reloadWidgetTimelines];
    });
}

// Sync auth tokens to App Group UserDefaults
RCT_EXPORT_METHOD(syncAuthTokens:(NSString *)csrftoken
                  accessToken:(NSString *)accessToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults setObject:csrftoken forKey:@"csrftoken"];
        [sharedDefaults setObject:accessToken forKey:@"access_token"];
        [sharedDefaults synchronize];

        // Reload widget timelines
        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Clear auth tokens from shared storage
RCT_EXPORT_METHOD(clearAuthTokens:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults removeObjectForKey:@"csrftoken"];
        [sharedDefaults removeObjectForKey:@"access_token"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Trigger widget refresh
RCT_EXPORT_METHOD(refreshWidgets:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (@available(iOS 14.0, *)) {
        [self reloadWidgetTimelinesWithFollowUp];
        resolve(@YES);
    } else {
        reject(@"UNSUPPORTED", @"Widgets require iOS 14+", nil);
    }
}

// Sync Spotify credentials to App Group UserDefaults
RCT_EXPORT_METHOD(syncSpotifyCredentials:(NSString *)clientId
                  clientSecret:(NSString *)clientSecret
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults setObject:clientId forKey:@"spotify_client_id"];
        [sharedDefaults setObject:clientSecret forKey:@"spotify_client_secret"];
        [sharedDefaults synchronize];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync API base URL to App Group UserDefaults
RCT_EXPORT_METHOD(syncApiBaseUrl:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults setObject:url forKey:@"api_base_url"];
        [sharedDefaults synchronize];
        NSLog(@"[WidgetBridge] syncApiBaseUrl: saved %@", url);
        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync my check-in data to App Group UserDefaults
RCT_EXPORT_METHOD(syncMyCheckIn:(NSDictionary *)checkInData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        // Convert dictionary to JSON data for storage
        NSError *error;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:checkInData
                                                           options:0
                                                             error:&error];
        if (error) {
            reject(@"ERROR", @"Failed to serialize check-in data", error);
            return;
        }

        [sharedDefaults setObject:jsonData forKey:@"my_check_in"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelinesWithFollowUp];
        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Clear my check-in data from shared storage
RCT_EXPORT_METHOD(clearMyCheckIn:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults removeObjectForKey:@"my_check_in"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync a shared-playlist track (someone else's song) to App Group UserDefaults.
// Stores the track metadata as JSON, plus base64-decoded album image and sharer avatar
// binaries. AlbumCoverWidget reads these directly without making network calls.
RCT_EXPORT_METHOD(syncSharedPlaylistTrack:(NSDictionary *)trackData
                  albumImageBase64:(NSString *)albumImageBase64
                  avatarImageBase64:(NSString *)avatarImageBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (!sharedDefaults) {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
        return;
    }

    // Track metadata → JSON
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:trackData
                                                       options:0
                                                         error:&error];
    if (error) {
        reject(@"ERROR", @"Failed to serialize shared playlist track", error);
        return;
    }
    [sharedDefaults setObject:jsonData forKey:@"shared_playlist_track"];

    // Album image binary (optional — empty string clears it)
    if (albumImageBase64.length > 0) {
        NSData *albumData = [[NSData alloc] initWithBase64EncodedString:albumImageBase64
                                                                options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (albumData) {
            [sharedDefaults setObject:albumData forKey:@"widget_shared_playlist_album_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_album_image"];
    }

    // Sharer avatar binary (optional)
    if (avatarImageBase64.length > 0) {
        NSData *avatarData = [[NSData alloc] initWithBase64EncodedString:avatarImageBase64
                                                                 options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (avatarData) {
            [sharedDefaults setObject:avatarData forKey:@"widget_shared_playlist_avatar_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_avatar_image"];
    }

    [sharedDefaults synchronize];

    [self reloadWidgetTimelinesWithFollowUp];
    resolve(@YES);
}

// Clear shared playlist data (used on logout)
RCT_EXPORT_METHOD(clearSharedPlaylistTrack:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults removeObjectForKey:@"shared_playlist_track"];
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_album_image"];
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_avatar_image"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync a friend post to App Group UserDefaults.
// Stores the post metadata as JSON, plus base64-decoded author image and post image binaries.
// PhotoWidget reads these directly without making network calls.
RCT_EXPORT_METHOD(syncFriendPost:(NSDictionary *)postData
                  authorImageBase64:(NSString *)authorImageBase64
                  postImageBase64:(NSString *)postImageBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (!sharedDefaults) {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
        return;
    }

    // Post metadata → JSON
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:postData
                                                       options:0
                                                         error:&error];
    if (error) {
        reject(@"ERROR", @"Failed to serialize friend post data", error);
        return;
    }
    [sharedDefaults setObject:jsonData forKey:@"friend_post"];

    // Post image binary (optional)
    if (postImageBase64.length > 0) {
        NSData *postImageData = [[NSData alloc] initWithBase64EncodedString:postImageBase64
                                                                    options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (postImageData) {
            [sharedDefaults setObject:postImageData forKey:@"widget_friend_post_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_post_image"];
    }

    // Author image binary (optional)
    if (authorImageBase64.length > 0) {
        NSData *authorImageData = [[NSData alloc] initWithBase64EncodedString:authorImageBase64
                                                                      options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (authorImageData) {
            [sharedDefaults setObject:authorImageData forKey:@"widget_friend_post_author_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_post_author_image"];
    }

    [sharedDefaults synchronize];
    NSLog(@"[WidgetBridge] syncFriendPost: saved friend_post to App Group, author=%@", postData[@"author_username"]);

    [self reloadWidgetTimelinesWithFollowUp];
    resolve(@YES);
}

// Clear friend post data from shared storage
RCT_EXPORT_METHOD(clearFriendPost:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults removeObjectForKey:@"friend_post"];
        [sharedDefaults removeObjectForKey:@"widget_friend_post_image"];
        [sharedDefaults removeObjectForKey:@"widget_friend_post_author_image"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync user version type to App Group UserDefaults
RCT_EXPORT_METHOD(syncVersionType:(NSString *)versionType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults setObject:versionType forKey:@"user_version_type"];
        [sharedDefaults synchronize];

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Read widget diagnostics for debugging
RCT_EXPORT_METHOD(getWidgetDiagnostics:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];
    if (!sharedDefaults) {
        resolve(@{
            @"lastSeenMood": @"(no suite)",
            @"lastSeenBattery": @"(no suite)",
            @"lastFeelingDisplay": @"(no suite)",
            @"lastBatteryDisplay": @"(no suite)",
            @"lastGetTimelineAt": @"",
            @"myCheckInJson": @"",
            @"myCheckInRawPresent": @NO,
            @"myCheckInDecodeOk": @NO,
            @"sharedPlaylistJson": @"",
            @"sharedPlaylistAlbumImageLen": @0,
            @"sharedPlaylistAvatarImageLen": @0,
            @"friendPostJson": @"",
            @"friendPostImageLen": @0,
            @"friendPostAuthorImageLen": @0,
            @"albumLastGetTimelineAt": @"(no suite)",
            @"albumLastSawTrackId": @"(no suite)",
            @"albumLastSharerUsername": @"(no suite)",
            @"albumLastAlbumImageLen": @0,
            @"albumLastAvatarImageLen": @0,
            @"albumLastDecodeError": @"(no suite)",
            @"csrftokenLen": @0,
            @"accessTokenLen": @0
        });
        return;
    }
    NSString *mood = [sharedDefaults stringForKey:@"widget_last_seen_mood"] ?: @"(never)";
    NSString *battery = [sharedDefaults stringForKey:@"widget_last_seen_battery"] ?: @"(never)";
    NSString *feelingDisplay = [sharedDefaults stringForKey:@"widget_last_feeling_display"] ?: @"(never)";
    NSString *batteryDisplay = [sharedDefaults stringForKey:@"widget_last_battery_display"] ?: @"(never)";
    NSString *dateStr = [sharedDefaults stringForKey:@"widget_last_getTimeline_at"] ?: @"";

    // Decode my_check_in (stored as NSData) back to a JSON string so the RN side can inspect it
    NSData *jsonData = [sharedDefaults dataForKey:@"my_check_in"];
    NSString *jsonString = @"";
    if (jsonData) {
        NSString *decoded = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        if (decoded) {
            jsonString = decoded;
        }
    }

    // Decode shared_playlist_track JSON
    NSData *spJsonData = [sharedDefaults dataForKey:@"shared_playlist_track"];
    NSString *spJsonString = @"";
    if (spJsonData) {
        NSString *decoded = [[NSString alloc] initWithData:spJsonData encoding:NSUTF8StringEncoding];
        if (decoded) {
            spJsonString = decoded;
        }
    }

    NSData *spAlbumData = [sharedDefaults dataForKey:@"widget_shared_playlist_album_image"];
    NSData *spAvatarData = [sharedDefaults dataForKey:@"widget_shared_playlist_avatar_image"];

    // Decode friend_post JSON
    NSData *fpJsonData = [sharedDefaults dataForKey:@"friend_post"];
    NSString *fpJsonString = @"";
    if (fpJsonData) {
        NSString *decoded = [[NSString alloc] initWithData:fpJsonData encoding:NSUTF8StringEncoding];
        if (decoded) {
            fpJsonString = decoded;
        }
    }

    NSData *fpImageData = [sharedDefaults dataForKey:@"widget_friend_post_image"];
    NSData *fpAuthorImageData = [sharedDefaults dataForKey:@"widget_friend_post_author_image"];

    // CheckinWidget raw-state flags (written from CheckinWidget.getTimeline)
    BOOL checkInRawPresent = [sharedDefaults boolForKey:@"widget_my_check_in_raw_present"];
    BOOL checkInDecodeOk   = [sharedDefaults boolForKey:@"widget_my_check_in_decode_ok"];

    // Auth token presence
    NSString *storedCsrf = [sharedDefaults stringForKey:@"csrftoken"] ?: @"";
    NSString *storedAccess = [sharedDefaults stringForKey:@"access_token"] ?: @"";
    NSInteger csrfLen = storedCsrf.length;
    NSInteger accessLen = storedAccess.length;

    // AlbumCoverWidget runtime diagnostics (written from AlbumCoverWidget.getTimeline)
    NSString *albumLastAt    = [sharedDefaults stringForKey:@"album_widget_last_getTimeline_at"] ?: @"(never)";
    NSString *albumTrackId   = [sharedDefaults stringForKey:@"album_widget_last_saw_track_id"] ?: @"(never)";
    NSString *albumSharer    = [sharedDefaults stringForKey:@"album_widget_last_sharer_username"] ?: @"(never)";
    NSInteger albumImgLen    = [sharedDefaults integerForKey:@"album_widget_last_album_image_len"];
    NSInteger albumAvatarLen = [sharedDefaults integerForKey:@"album_widget_last_avatar_image_len"];
    NSString *albumDecodeErr = [sharedDefaults stringForKey:@"album_widget_last_decode_error"] ?: @"";

    resolve(@{
        @"lastSeenMood": mood,
        @"lastSeenBattery": battery,
        @"lastFeelingDisplay": feelingDisplay,
        @"lastBatteryDisplay": batteryDisplay,
        @"lastGetTimelineAt": dateStr,
        @"myCheckInJson": jsonString,
        @"myCheckInRawPresent": @(checkInRawPresent),
        @"myCheckInDecodeOk": @(checkInDecodeOk),
        @"sharedPlaylistJson": spJsonString,
        @"sharedPlaylistAlbumImageLen": @(spAlbumData.length),
        @"sharedPlaylistAvatarImageLen": @(spAvatarData.length),
        @"friendPostJson": fpJsonString,
        @"friendPostImageLen": @(fpImageData.length),
        @"friendPostAuthorImageLen": @(fpAuthorImageData.length),
        @"albumLastGetTimelineAt": albumLastAt,
        @"albumLastSawTrackId": albumTrackId,
        @"albumLastSharerUsername": albumSharer,
        @"albumLastAlbumImageLen": @(albumImgLen),
        @"albumLastAvatarImageLen": @(albumAvatarLen),
        @"albumLastDecodeError": albumDecodeErr,
        @"csrftokenLen": @(csrfLen),
        @"accessTokenLen": @(accessLen)
    });
}

@end
