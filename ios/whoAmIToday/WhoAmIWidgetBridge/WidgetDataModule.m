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
        // Reload again after a short delay so the widget extension gets a chance to run when app is in background
        __weak typeof(self) weakSelf = self;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.6 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [weakSelf reloadWidgetTimelines];
            NSLog(@"[WidgetBridge] refreshWidgets: delayed reload (0.6s) requested");
        });
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
        NSLog(@"[WidgetBridge] syncMyCheckIn: wrote my_check_in to App Group, id=%@ mood=%@", checkInId, mood);

        [self reloadWidgetTimelines];

        __weak typeof(self) weakSelf = self;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [weakSelf reloadWidgetTimelines];
            NSLog(@"[WidgetBridge] syncMyCheckIn: reload after 0.4s");
        });
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [weakSelf reloadWidgetTimelines];
            NSLog(@"[WidgetBridge] syncMyCheckIn: second reload after 1.0s");
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

// Read widget diagnostics (when widget last ran getTimeline and what mood it saw) for debugging
RCT_EXPORT_METHOD(getWidgetDiagnostics:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
        initWithSuiteName:@"group.com.whoami.today.app"];
    if (!sharedDefaults) {
        resolve(@{@"lastSeenMood": @"(no suite)", @"lastGetTimelineAt": @""});
        return;
    }
    NSString *mood = [sharedDefaults stringForKey:@"widget_last_seen_mood"] ?: @"(never)";
    NSString *battery = [sharedDefaults stringForKey:@"widget_last_seen_battery"] ?: @"(never)";
    NSString *feelingDisplay = [sharedDefaults stringForKey:@"widget_last_feeling_display"] ?: @"(never)";
    NSString *batteryDisplay = [sharedDefaults stringForKey:@"widget_last_battery_display"] ?: @"(never)";
    NSString *dateStr = [sharedDefaults stringForKey:@"widget_last_getTimeline_at"] ?: @"";

    // Also read the raw my_check_in JSON so we can inspect what was written by the bridge
    NSString *myCheckInJson = @"(none)";
    NSData *checkInData = [sharedDefaults dataForKey:@"my_check_in"];
    if (checkInData) {
        NSString *jsonStr = [[NSString alloc] initWithData:checkInData encoding:NSUTF8StringEncoding];
        if (jsonStr) myCheckInJson = jsonStr;
    }

    resolve(@{
        @"lastSeenMood": mood,
        @"lastSeenBattery": battery,
        @"lastFeelingDisplay": feelingDisplay,
        @"lastBatteryDisplay": batteryDisplay,
        @"lastGetTimelineAt": dateStr,
        @"myCheckInJson": myCheckInJson
    });
}

@end
