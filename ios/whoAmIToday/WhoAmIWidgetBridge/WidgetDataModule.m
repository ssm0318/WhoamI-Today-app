#import "WidgetDataModule.h"

@implementation WidgetDataModule

RCT_EXPORT_MODULE();

// Widget kind must match WhoAmITodayWidget.swift: let kind = "WhoAmITodayWidget"
static NSString *const kWidgetKind = @"WhoAmITodayWidget";

// Helper method to reload widget timelines using runtime check
- (void)reloadWidgetTimelines {
    if (@available(iOS 14.0, *)) {
        Class WidgetCenterClass = NSClassFromString(@"WidgetCenter");
        if (WidgetCenterClass) {
            id sharedCenter = [WidgetCenterClass performSelector:@selector(shared)];
            if (sharedCenter) {
                NSLog(@"[WidgetBridge] reloadWidgetTimelines: calling reloadAllTimelines");
                [sharedCenter performSelector:@selector(reloadAllTimelines)];
                // Also request our widget kind specifically; can help when app is in background
                SEL reloadKindSel = NSSelectorFromString(@"reloadTimelinesOfKind:");
                if ([sharedCenter respondsToSelector:reloadKindSel]) {
                    [sharedCenter performSelector:reloadKindSel withObject:kWidgetKind];
                    NSLog(@"[WidgetBridge] reloadWidgetTimelines: called reloadTimelines(ofKind: %@)", kWidgetKind);
                }
            }
        } else {
            NSLog(@"[WidgetBridge] reloadWidgetTimelines: WidgetCenter not available (iOS < 14)");
        }
    }
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
        [self reloadWidgetTimelines];
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
        NSString *mood = checkInData[@"mood"] ?: @"(nil)";
        NSNumber *checkInId = checkInData[@"id"];
        // This log appears in Xcode: run main app scheme (whoAmIToday), open Debug area (Cmd+Shift+Y), then background the app to trigger sync
        NSLog(@"[WidgetBridge] syncMyCheckIn: wrote my_check_in to App Group, id=%@ mood=%@", checkInId, mood);

        // Reload widget timelines immediately
        [self reloadWidgetTimelines];
        // Reload again after a short delay so widget extension can see the written UserDefaults (helps when app is in background)
        __weak typeof(self) weakSelf = self;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.6 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [weakSelf reloadWidgetTimelines];
            NSLog(@"[WidgetBridge] syncMyCheckIn: delayed reload (0.6s) requested");
        });

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

@end
