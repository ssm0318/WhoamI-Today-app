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
    // UIGraphicsImageRenderer is thread-safe (unlike the deprecated
    // UIGraphicsBeginImageContextWithOptions which must run on the main thread
    // and crashes on background threads in iOS 17+).
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
    format.scale = 1.0;
    format.opaque = NO;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format];
    NSData *jpeg = [renderer JPEGDataWithCompressionQuality:0.88 actions:^(UIGraphicsImageRendererContext * _Nonnull ctx) {
        [image drawInRect:CGRectMake(0, 0, targetSize.width, targetSize.height)];
    }];
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
        _waiLastFireTimesByKind = [NSMutableDictionary dictionary];
        _waiFollowUpGensByKind = [NSMutableDictionary dictionary];
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

// Debounce + coalesce. Multiple JS paths (WIDGET_DATA_UPDATED,
// app-state-inactive auto sync, refreshWidgets) fan into this method in
// quick succession, and the previous implementation fired every call
// verbatim — logs showed 20+ reload requests in 5s, tripping iOS's widget
// refresh budget so getTimeline never ran. Now: at most one immediate
// reload per cooldown window, plus one follow-up scheduled from the MOST
// RECENT call (generation counter invalidates older pending follow-ups).
static NSTimeInterval const kWAIImmediateReloadCooldown = 1.5;
static NSTimeInterval const kWAIFollowUpDelay = 2.0;
static NSDate *_waiLastImmediateFireTime = nil;
static NSUInteger _waiFollowUpGeneration = 0;

// Per-kind reload state. iOS budgets widget reloads per-kind, so reloading
// only the affected kind (e.g. CheckinWidgetV3 on a check-in save) leaves
// the other widgets' budgets untouched. Keyed by widget kind string.
static NSMutableDictionary<NSString *, NSDate *> *_waiLastFireTimesByKind = nil;
static NSMutableDictionary<NSString *, NSNumber *> *_waiFollowUpGensByKind = nil;

- (void)reloadTimelinesOfKind:(NSString *)kind {
    if (@available(iOS 14.0, *)) {
        Class WidgetCenterClass = NSClassFromString(@"WidgetCenter");
        if (WidgetCenterClass) {
            id sharedCenter = [WidgetCenterClass performSelector:@selector(shared)];
            if (sharedCenter) {
                [sharedCenter performSelector:@selector(reloadTimelinesOfKind:) withObject:kind];
                NSLog(@"[WidgetSync][iOSNative] reloadTimelinesOfKind:%@ sent", kind);
            }
        }
    }
}

- (void)reloadTimelinesWithFollowUpForKind:(NSString *)kind {
    __weak typeof(self) weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        typeof(self) strongSelf = weakSelf;
        if (!strongSelf) return;

        NSDate *now = [NSDate date];
        NSDate *lastFire = _waiLastFireTimesByKind[kind];
        NSTimeInterval elapsed = lastFire
            ? [now timeIntervalSinceDate:lastFire]
            : INFINITY;

        if (elapsed >= kWAIImmediateReloadCooldown) {
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp[%@] fire (elapsed=%.2fs)", kind, elapsed);
            _waiLastFireTimesByKind[kind] = now;
            [strongSelf reloadTimelinesOfKind:kind];
        } else {
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp[%@] coalesced (elapsed=%.2fs)", kind, elapsed);
        }

        NSUInteger gen = [(_waiFollowUpGensByKind[kind] ?: @0) unsignedIntegerValue] + 1;
        _waiFollowUpGensByKind[kind] = @(gen);

        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kWAIFollowUpDelay * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            NSUInteger currentGen = [_waiFollowUpGensByKind[kind] unsignedIntegerValue];
            if (gen != currentGen) {
                return;
            }
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp[%@] follow-up fires (gen=%lu)",
                  kind, (unsigned long)gen);
            _waiLastFireTimesByKind[kind] = [NSDate date];
            [weakSelf reloadTimelinesOfKind:kind];
        });
    });
}

- (void)forceReloadAllWidgetKindsWithRetries {
    [self reloadWidgetTimelines];
    [self reloadTimelinesOfKind:@"CheckinWidgetV3"];
    [self reloadTimelinesOfKind:@"AlbumCoverWidgetV3"];
    [self reloadTimelinesOfKind:@"PhotoWidget"];
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        [weakSelf reloadTimelinesOfKind:@"CheckinWidgetV3"];
        [weakSelf reloadTimelinesOfKind:@"AlbumCoverWidgetV3"];
        [weakSelf reloadTimelinesOfKind:@"PhotoWidget"];
    });
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(6.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        [weakSelf reloadTimelinesOfKind:@"CheckinWidgetV3"];
        [weakSelf reloadTimelinesOfKind:@"AlbumCoverWidgetV3"];
        [weakSelf reloadTimelinesOfKind:@"PhotoWidget"];
    });
}

- (void)reloadWidgetTimelinesWithFollowUp {
    __weak typeof(self) weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        typeof(self) strongSelf = weakSelf;
        if (!strongSelf) return;

        NSDate *now = [NSDate date];
        NSTimeInterval elapsed = _waiLastImmediateFireTime
            ? [now timeIntervalSinceDate:_waiLastImmediateFireTime]
            : INFINITY;

        if (elapsed >= kWAIImmediateReloadCooldown) {
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp fire (elapsed=%.2fs)", elapsed);
            _waiLastImmediateFireTime = now;
            [strongSelf reloadWidgetTimelines];
        } else {
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp coalesced (elapsed=%.2fs)", elapsed);
        }

        NSUInteger gen = ++_waiFollowUpGeneration;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kWAIFollowUpDelay * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            if (gen != _waiFollowUpGeneration) {
                return; // superseded by a newer call
            }
            NSLog(@"[WidgetSync][iOSNative] reloadWithFollowUp follow-up fires (gen=%lu)",
                  (unsigned long)gen);
            _waiLastImmediateFireTime = [NSDate date];
            [weakSelf reloadWidgetTimelines];
        });
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

        [self forceReloadAllWidgetKindsWithRetries];

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

        // Kind-specific: only reload CheckinWidgetV3 so check-in saves don't
        // burn album/photo widgets' reload budgets.
        [self reloadTimelinesWithFollowUpForKind:@"CheckinWidgetV3"];
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

    // Friend update diagnostics
    NSData *fpJsonData = [sharedDefaults dataForKey:@"friend_update"];
    NSString *fpJsonString = @"";
    if (fpJsonData) {
        NSString *decoded = [[NSString alloc] initWithData:fpJsonData encoding:NSUTF8StringEncoding];
        if (decoded) {
            fpJsonString = decoded;
        }
    }
    NSData *fpImageData = [sharedDefaults dataForKey:@"widget_friend_update_content_image"];
    NSData *fpAuthorData = [sharedDefaults dataForKey:@"widget_friend_update_profile_image"];

    // Widget-side render diagnostics (written from PhotoWidgetProvider.currentEntry)
    NSString *photoRenderDiag = [sharedDefaults stringForKey:@"photo_widget_last_render_diag"] ?: @"(never)";
    NSString *photoRenderAt = [sharedDefaults stringForKey:@"photo_widget_last_render_at"] ?: @"(never)";

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
        @"friendUpdateJson": fpJsonString,
        @"friendUpdateContentImageLen": @(fpImageData.length),
        @"friendUpdateProfileImageLen": @(fpAuthorData.length),
        @"photoWidgetLastRenderDiag": photoRenderDiag,
        @"photoWidgetLastRenderAt": photoRenderAt,
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

// Sync a friend update (post OR check-in) to App Group UserDefaults.
// Stores the union payload as JSON, plus base64-decoded profile and content image binaries.
// PhotoWidget reads these directly without making network calls.
RCT_EXPORT_METHOD(syncFriendUpdate:(NSDictionary *)payload
                  profileImageBase64:(NSString *)profileImageBase64
                  contentImageBase64:(NSString *)contentImageBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (!sharedDefaults) {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
        return;
    }

    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload
                                                       options:0
                                                         error:&error];
    if (error) {
        reject(@"ERROR", @"Failed to serialize friend update payload", error);
        return;
    }
    [sharedDefaults setObject:jsonData forKey:@"friend_update"];
    // Clean up legacy keys
    [sharedDefaults removeObjectForKey:@"friend_post"];

    if (profileImageBase64.length > 0) {
        NSData *profileData = [[NSData alloc] initWithBase64EncodedString:profileImageBase64
                                                                  options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (profileData) {
            [sharedDefaults setObject:profileData forKey:@"widget_friend_update_profile_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_update_profile_image"];
    }

    if (contentImageBase64.length > 0) {
        NSData *contentData = [[NSData alloc] initWithBase64EncodedString:contentImageBase64
                                                                  options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (contentData) {
            [sharedDefaults setObject:contentData forKey:@"widget_friend_update_content_image"];
        }
    } else {
        [sharedDefaults removeObjectForKey:@"widget_friend_update_content_image"];
    }
    // Clean up legacy image keys
    [sharedDefaults removeObjectForKey:@"widget_friend_post_image"];
    [sharedDefaults removeObjectForKey:@"widget_friend_post_author_image"];

    [sharedDefaults synchronize];

    [self reloadWidgetTimelinesWithFollowUp];
    resolve(@YES);
}

// Clear friend update data (used on logout)
RCT_EXPORT_METHOD(clearFriendUpdate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (sharedDefaults) {
        [sharedDefaults removeObjectForKey:@"friend_update"];
        [sharedDefaults removeObjectForKey:@"widget_friend_update_content_image"];
        [sharedDefaults removeObjectForKey:@"widget_friend_update_profile_image"];
        // Legacy cleanup
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

// Clear all widget-related auth/data in one native transaction (used on logout).
// This reduces the chance of stale widget snapshots when JS is suspended quickly
// after signout/backgrounding.
RCT_EXPORT_METHOD(clearAllWidgetData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];

    if (!sharedDefaults) {
        reject(@"ERROR", @"Failed to access shared UserDefaults", nil);
        return;
    }

    // Auth
    [sharedDefaults removeObjectForKey:@"csrftoken"];
    [sharedDefaults removeObjectForKey:@"access_token"];
    WAIRemoveAppGroupFile(@"widget_auth_csrftoken.txt");
    WAIRemoveAppGroupFile(@"widget_auth_access_token.txt");

    // Check-in
    [sharedDefaults removeObjectForKey:@"my_check_in"];
    [sharedDefaults removeObjectForKey:@"widget_album_image"];
    WAIRemoveAppGroupFile(@"my_check_in.json");
    WAIRemoveAppGroupFile(@"widget_album_image.bin");

    // Shared playlist
    [sharedDefaults removeObjectForKey:@"shared_playlist_track"];
    [sharedDefaults removeObjectForKey:@"widget_shared_playlist_album_image"];
    [sharedDefaults removeObjectForKey:@"widget_shared_playlist_avatar_image"];
    WAIRemoveAppGroupFile(@"shared_playlist_album.bin");
    WAIRemoveAppGroupFile(@"shared_playlist_avatar.bin");

    // Friend update + legacy keys
    [sharedDefaults removeObjectForKey:@"friend_update"];
    [sharedDefaults removeObjectForKey:@"widget_friend_update_content_image"];
    [sharedDefaults removeObjectForKey:@"widget_friend_update_profile_image"];
    [sharedDefaults removeObjectForKey:@"friend_post"];
    [sharedDefaults removeObjectForKey:@"widget_friend_post_image"];
    [sharedDefaults removeObjectForKey:@"widget_friend_post_author_image"];

    [sharedDefaults synchronize];

    // Logout path: deterministic multi-shot refresh per widget kind.
    [self forceReloadAllWidgetKindsWithRetries];
    resolve(@YES);
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
