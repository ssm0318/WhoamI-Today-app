#import "WidgetDataModule.h"
#import <UIKit/UIKit.h>

/// Downscale and JPEG-encode image bytes before App Group storage. Widget extensions have tight
/// memory budgets; very large profile photos (100k+ base64) often decode fine in the app but fail
/// or render blank in `UIImage(data:)` inside the widget process.
static NSData *WAIWidgetImageDataForWidgetStorage(NSData *data, CGFloat maxSidePoints) {
    if (data.length == 0) {
        return nil;
    }
    UIImage *image = [UIImage imageWithData:data];
    if (!image) {
        return data;
    }
    CGFloat w = image.size.width * image.scale;
    CGFloat h = image.size.height * image.scale;
    CGFloat maxSide = MAX(w, h);
    CGSize targetSize;
    if (maxSide <= maxSidePoints) {
        targetSize = CGSizeMake(w, h);
    } else {
        CGFloat ratio = maxSidePoints / maxSide;
        targetSize = CGSizeMake(round(w * ratio), round(h * ratio));
    }
    if (targetSize.width < 1 || targetSize.height < 1) {
        return data;
    }
    UIGraphicsBeginImageContextWithOptions(targetSize, NO, 1.0);
    [image drawInRect:CGRectMake(0, 0, targetSize.width, targetSize.height)];
    UIImage *scaled = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    if (!scaled) {
        return data;
    }
    NSData *jpeg = UIImageJPEGRepresentation(scaled, 0.88);
    return jpeg ?: data;
}

static NSString *const kWAIAppGroupId = @"group.com.whoami.today.app";

static NSURL *WAIAppGroupRootURL(void) {
    return [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:kWAIAppGroupId];
}

static void WAIWriteDataFile(NSString *filename, NSData *data) {
    NSURL *root = WAIAppGroupRootURL();
    if (!root || !data) {
        return;
    }
    NSURL *fileURL = [root URLByAppendingPathComponent:filename];
    [data writeToURL:fileURL atomically:YES];
}

static void WAIWriteUTF8File(NSString *filename, NSString *string) {
    if (!string) {
        return;
    }
    NSData *data = [string dataUsingEncoding:NSUTF8StringEncoding];
    WAIWriteDataFile(filename, data);
}

static void WAIRemoveAppGroupFile(NSString *filename) {
    NSURL *root = WAIAppGroupRootURL();
    if (!root) {
        return;
    }
    NSURL *fileURL = [root URLByAppendingPathComponent:filename];
    [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
}

static NSString *WAIReadUTF8AppGroupFile(NSString *filename) {
    NSURL *root = WAIAppGroupRootURL();
    if (!root) {
        return @"";
    }
    NSURL *fileURL = [root URLByAppendingPathComponent:filename];
    NSData *data = [NSData dataWithContentsOfURL:fileURL];
    if (!data) {
        return @"";
    }
    NSString *decoded = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return decoded ?: @"";
}

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
            @"AlbumCoverWidgetV3",
            @"CheckinWidgetV3"
        ];
    }
}

- (void)reloadWidgetTimelines {
    if (@available(iOS 14.0, *)) {
        NSLog(@"[WidgetSync][iOSNative] reloadWidgetTimelines called at %@", [NSDate date]);
        Class WidgetCenterClass = NSClassFromString(@"WidgetCenter");
        if (WidgetCenterClass) {
            id sharedCenter = [WidgetCenterClass performSelector:@selector(shared)];
            if (sharedCenter) {
                // reloadAllTimelines alone covers every widget kind; the per-kind fan-out
                // we used to run (4×) multiplied real-device budget exhaustion and made
                // iOS stop calling getTimeline altogether.
                [sharedCenter performSelector:@selector(reloadAllTimelines)];
                NSLog(@"[WidgetSync][iOSNative] reloadAllTimelines sent at %@", [NSDate date]);
            }
        }
    }
}

// Fire one reload immediately + exactly one follow-up ~2s later to catch the case
// where the host app was still foregrounded when the first reload hit iOS's refresh
// budget. Every additional call beyond this burnt budget without increasing the odds
// of getTimeline actually running.
- (void)reloadWidgetTimelinesWithFollowUp {
    NSLog(@"[WidgetSync][iOSNative] reloadWidgetTimelinesWithFollowUp start at %@", [NSDate date]);
    [self reloadWidgetTimelines];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        NSLog(@"[WidgetSync][iOSNative] reloadWidgetTimelinesWithFollowUp +2.0s at %@", [NSDate date]);
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

        // Mirror to files so the widget extension can read tokens (cfprefs/plist can be stale there).
        WAIWriteUTF8File(@"widget_auth_csrftoken.txt", csrftoken);
        WAIWriteUTF8File(@"widget_auth_access_token.txt", accessToken);

        [self reloadWidgetTimelinesWithFollowUp];

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

        WAIRemoveAppGroupFile(@"widget_auth_csrftoken.txt");
        WAIRemoveAppGroupFile(@"widget_auth_access_token.txt");

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
        NSLog(@"[WidgetSync][iOSNative] refreshWidgets invoked at %@", [NSDate date]);
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

// Sync my check-in data to App Group UserDefaults
RCT_EXPORT_METHOD(syncMyCheckIn:(NSDictionary *)checkInData
                  albumImageBase64:(NSString *)albumImageBase64
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
        WAIWriteDataFile(@"my_check_in.json", jsonData);

        // Verify the file actually hit disk with the expected payload — lets us see
        // whether Q1 (App Group file has new battery) passes without inspecting the
        // device file system. Reads back, logs size + first 240 bytes of preview.
        NSURL *verifyRoot = WAIAppGroupRootURL();
        if (verifyRoot) {
            NSURL *verifyURL = [verifyRoot URLByAppendingPathComponent:@"my_check_in.json"];
            NSData *readBack = [NSData dataWithContentsOfURL:verifyURL];
            NSString *preview = @"";
            if (readBack.length > 0) {
                NSData *sliced = readBack.length > 240
                    ? [readBack subdataWithRange:NSMakeRange(0, 240)]
                    : readBack;
                preview = [[NSString alloc] initWithData:sliced encoding:NSUTF8StringEncoding] ?: @"(non-utf8)";
            }
            NSLog(@"[WidgetSync][iOSNative] syncMyCheckIn file write verified: size=%lu, preview=\"%@\"",
                  (unsigned long)readBack.length, preview);
        }

        // Store album image binary if provided
        if (albumImageBase64.length > 0) {
            NSData *imageData = [[NSData alloc] initWithBase64EncodedString:albumImageBase64
                                                                   options:NSDataBase64DecodingIgnoreUnknownCharacters];
            if (imageData) {
                [sharedDefaults setObject:imageData forKey:@"widget_album_image"];
                WAIWriteDataFile(@"widget_album_image.bin", imageData);
            }
        } else {
            [sharedDefaults removeObjectForKey:@"widget_album_image"];
            WAIRemoveAppGroupFile(@"widget_album_image.bin");
        }

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
        [sharedDefaults removeObjectForKey:@"widget_album_image"];
        [sharedDefaults synchronize];

        WAIRemoveAppGroupFile(@"my_check_in.json");
        WAIRemoveAppGroupFile(@"widget_album_image.bin");

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

    // Album image — store both in UserDefaults AND as a file for reliable widget access
    NSURL *containerURL = [[NSFileManager defaultManager]
        containerURLForSecurityApplicationGroupIdentifier:@"group.com.whoami.today.app"];

    if (albumImageBase64.length > 0) {
        NSData *albumData = [[NSData alloc] initWithBase64EncodedString:albumImageBase64
                                                                options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (albumData) {
            NSData *storedAlbum = WAIWidgetImageDataForWidgetStorage(albumData, 512);
            if (storedAlbum) {
                [sharedDefaults setObject:storedAlbum forKey:@"widget_shared_playlist_album_image"];
                if (containerURL) {
                    [storedAlbum writeToURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_album.bin"]
                                 atomically:YES];
                }
            }
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_album_image"];
        if (containerURL) {
            [[NSFileManager defaultManager] removeItemAtURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_album.bin"] error:nil];
        }
    }

    // Sharer avatar — same dual storage
    if (avatarImageBase64.length > 0) {
        NSData *avatarData = [[NSData alloc] initWithBase64EncodedString:avatarImageBase64
                                                                 options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (avatarData) {
            NSData *storedAvatar = WAIWidgetImageDataForWidgetStorage(avatarData, 160);
            if (storedAvatar) {
                [sharedDefaults setObject:storedAvatar forKey:@"widget_shared_playlist_avatar_image"];
                if (containerURL) {
                    [storedAvatar writeToURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_avatar.bin"]
                                 atomically:YES];
                }
            }
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_shared_playlist_avatar_image"];
        if (containerURL) {
            [[NSFileManager defaultManager] removeItemAtURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_avatar.bin"] error:nil];
        }
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

        NSURL *containerURL = [[NSFileManager defaultManager]
            containerURLForSecurityApplicationGroupIdentifier:@"group.com.whoami.today.app"];
        if (containerURL) {
            [[NSFileManager defaultManager] removeItemAtURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_album.bin"] error:nil];
            [[NSFileManager defaultManager] removeItemAtURL:[containerURL URLByAppendingPathComponent:@"shared_playlist_avatar.bin"] error:nil];
        }

        [self reloadWidgetTimelines];

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Read widget diagnostics (when widget last ran getTimeline, what mood/battery it saw,
// and the raw my_check_in / shared_playlist_track JSON the widget will read on its next refresh)
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

    // CheckinWidget raw-state flags (written from CheckinWidget.getTimeline)
    BOOL checkInRawPresent = [sharedDefaults boolForKey:@"widget_my_check_in_raw_present"];
    BOOL checkInDecodeOk   = [sharedDefaults boolForKey:@"widget_my_check_in_decode_ok"];
    NSString *checkInDecodeSource = [sharedDefaults stringForKey:@"widget_my_check_in_decode_source"] ?: @"(never)";
    NSString *checkInRawPreview = [sharedDefaults stringForKey:@"widget_my_check_in_raw_preview"] ?: @"";
    NSString *checkInJsonFile = WAIReadUTF8AppGroupFile(@"my_check_in.json");

    // Auth token presence — if these come back 0/empty but app shows user logged in,
    // it means syncTokensToWidget was never called OR its write didn't stick.
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

    // Friend post diagnostics
    NSData *fpJsonData = [sharedDefaults dataForKey:@"friend_post"];
    NSString *fpJsonString = @"";
    if (fpJsonData) {
        NSString *decoded = [[NSString alloc] initWithData:fpJsonData encoding:NSUTF8StringEncoding];
        if (decoded) {
            fpJsonString = decoded;
        }
    }
    NSData *fpImageData = [sharedDefaults dataForKey:@"widget_friend_post_image"];
    NSData *fpAuthorData = [sharedDefaults dataForKey:@"widget_friend_post_author_image"];

    resolve(@{
        @"lastSeenMood": mood,
        @"lastSeenBattery": battery,
        @"lastFeelingDisplay": feelingDisplay,
        @"lastBatteryDisplay": batteryDisplay,
        @"lastGetTimelineAt": dateStr,
        @"myCheckInJson": jsonString,
        @"myCheckInJsonFile": checkInJsonFile,
        @"myCheckInRawPresent": @(checkInRawPresent),
        @"myCheckInDecodeOk": @(checkInDecodeOk),
        @"myCheckInDecodeSource": checkInDecodeSource,
        @"myCheckInRawPreview": checkInRawPreview,
        @"sharedPlaylistJson": spJsonString,
        @"sharedPlaylistAlbumImageLen": @(spAlbumData.length),
        @"sharedPlaylistAvatarImageLen": @(spAvatarData.length),
        @"albumLastGetTimelineAt": albumLastAt,
        @"albumLastSawTrackId": albumTrackId,
        @"albumLastSharerUsername": albumSharer,
        @"albumLastAlbumImageLen": @(albumImgLen),
        @"albumLastAvatarImageLen": @(albumAvatarLen),
        @"albumLastDecodeError": albumDecodeErr,
        @"friendPostJson": fpJsonString,
        @"friendPostImageLen": @(fpImageData.length),
        @"friendPostAuthorImageLen": @(fpAuthorData.length),
        @"csrftokenLen": @(csrfLen),
        @"accessTokenLen": @(accessLen)
    });
}

// Sync API base URL to App Group UserDefaults (used by widget self-fetch)
RCT_EXPORT_METHOD(syncApiBaseUrl:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults setObject:url forKey:@"api_base_url"];
        [sharedDefaults synchronize];

        WAIWriteUTF8File(@"widget_api_base_url.txt", url);

        resolve(@YES);
    } else {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
    }
}

// Sync a friend post to App Group UserDefaults.
// Stores the post metadata as JSON, plus base64-decoded author avatar and post image binaries.
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

    // Author avatar binary (optional — empty string clears it)
    if (authorImageBase64.length > 0) {
        NSData *authorData = [[NSData alloc] initWithBase64EncodedString:authorImageBase64
                                                                options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (authorData) {
            [sharedDefaults setObject:authorData forKey:@"widget_friend_post_author_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_post_author_image"];
    }

    // Post image binary (optional)
    if (postImageBase64.length > 0) {
        NSData *postImgData = [[NSData alloc] initWithBase64EncodedString:postImageBase64
                                                                  options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (postImgData) {
            [sharedDefaults setObject:postImgData forKey:@"widget_friend_post_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_post_image"];
    }

    [sharedDefaults synchronize];

    [self reloadWidgetTimelinesWithFollowUp];
    resolve(@YES);
}

// Clear friend post data (used on logout)
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

@end
