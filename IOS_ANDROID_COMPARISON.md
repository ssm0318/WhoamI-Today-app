# iOS vs Android Widget Implementation Comparison

## Feature Parity Matrix

| Feature | iOS | Android | Status |
|---------|-----|---------|--------|
| **Data Storage** | App Group UserDefaults | SharedPreferences | ✅ Both implemented |
| **Sync Method** | `syncMyCheckIn` | `syncMyCheckIn` | ✅ Same interface |
| **Clear Method** | `clearMyCheckIn` | `clearMyCheckIn` | ✅ Same interface |
| **Auth Sync** | `syncAuthTokens` | `syncAuthTokens` | ✅ Same interface |
| **Shared Playlist Sync** | `syncSharedPlaylistTrack` | `syncSharedPlaylistTrack` | ✅ Now implemented |
| **Shared Playlist Clear** | `clearSharedPlaylistTrack` | `clearSharedPlaylistTrack` | ✅ Now implemented |
| **Version Type Sync** | `syncVersionType` | `syncVersionType` | ✅ Same interface |
| **Spotify Credentials** | `syncSpotifyCredentials` | `syncSpotifyCredentials` | ✅ Same interface |
| **Widget Refresh** | `refreshWidgets` | `refreshWidgets` | ✅ Same interface |
| **Diagnostics** | `getWidgetDiagnostics` | `getWidgetDiagnostics` | ✅ Now implemented |
| **Delayed Retry** | `reloadWidgetTimelinesWithFollowUp` (800ms) | `updateWidgetsWithFollowUp` (800ms) | ✅ Same pattern |
| **Synchronous Write** | `synchronize` | `commit()` | ✅ Both synchronous |

## Implementation Details

### Data Storage

**iOS:**
```objc
NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc]
    initWithSuiteName:@"group.com.whoami.today.app"];
[sharedDefaults setObject:jsonData forKey:@"my_check_in"];
[sharedDefaults synchronize];
```

**Android:**
```java
SharedPreferences prefs = context.getSharedPreferences("WhoAmIWidgetPrefs", Context.MODE_PRIVATE);
prefs.edit().putString("widget_data", json).commit();
```

**Differences:**
- iOS: Separate keys for each data type
- Android: Single `widget_data` JSON with nested objects
- Both: Synchronous write for reliability

### Widget Update Trigger

**iOS:**
```objc
- (void)reloadWidgetTimelinesWithFollowUp {
    [self reloadWidgetTimelines];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.8 * NSEC_PER_SEC)), 
                   dispatch_get_main_queue(), ^{
        [self reloadWidgetTimelines];
    });
}
```

**Android:**
```java
private void updateWidgetsWithFollowUp(Context context) {
    updateWidgets(context);
    mainHandler.postDelayed(() -> {
        updateWidgets(context);
    }, 800);
}
```

**Similarities:**
- Both use 800ms delay
- Both trigger immediate + delayed update
- Both ensure data availability

### Diagnostics

**iOS:**
```objc
RCT_EXPORT_METHOD(getWidgetDiagnostics:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // Returns NSDictionary
    resolve(diagnosticsDict);
}
```

**Android:**
```java
@ReactMethod
public void getWidgetDiagnostics(Promise promise) {
    // Returns JSON string
    promise.resolve(diagnostics.toString());
}
```

**Differences:**
- iOS: Returns object directly
- Android: Returns JSON string (parsed in TypeScript)
- Both: Contain same diagnostic information

### Shared Playlist Images

**iOS:**
```objc
// Stores binary data
NSData *albumData = [[NSData alloc] initWithBase64EncodedString:albumImageBase64 ...];
[sharedDefaults setObject:albumData forKey:@"widget_shared_playlist_album_image"];
```

**Android:**
```java
// Stores base64 string
editor.putString("widget_shared_playlist_album_image_base64", albumImageBase64);
```

**Differences:**
- iOS: Decodes base64 and stores binary
- Android: Stores base64 string directly
- Reason: SharedPreferences doesn't handle byte arrays well

## Data Structure Comparison

### iOS App Group Keys

```
csrftoken: String
access_token: String
user_version_type: String
my_check_in: Data (JSON)
widget_album_image: Data (binary)
shared_playlist_track: Data (JSON)
widget_shared_playlist_album_image: Data (binary)
widget_shared_playlist_avatar_image: Data (binary)
spotify_client_id: String
spotify_client_secret: String
```

### Android SharedPreferences Keys

```
csrftoken: String
access_token: String
user_version_type: String
widget_data: String (JSON containing my_check_in and shared_playlist_track)
widget_shared_playlist_album_image_base64: String
widget_shared_playlist_avatar_image_base64: String
spotify_client_id: String
spotify_client_secret: String
```

### widget_data JSON Structure (Android)

```json
{
  "my_check_in": {
    "id": 123,
    "is_active": true,
    "created_at": "2026-04-11T12:00:00Z",
    "mood": "happy",
    "social_battery": "moderately_social",
    "description": "Feeling great!",
    "track_id": "spotify:track:...",
    "album_image_url": "https://..."
  },
  "shared_playlist_track": {
    "id": 456,
    "track_id": "spotify:track:...",
    "album_image_url": "https://...",
    "sharer_username": "friend123",
    "sharer_profile_image_url": "https://..."
  }
}
```

## Widget Types

### iOS (WidgetKit)

1. **CheckinWidget** (`CheckinWidgetV2`)
   - Shows mood, battery, music, thought
   - Timeline updates every 15 minutes
   - Deep links to specific editors

2. **AlbumCoverWidget** (`AlbumCoverWidgetV2`)
   - Shows shared playlist track
   - Album art + sharer avatar
   - Timeline updates every 15 minutes

3. **PhotoWidget**
   - Shows random photo (Picsum placeholder)
   - Timeline updates every 1 hour

### Android (AppWidgetProvider)

1. **CheckinWidgetProvider**
   - Shows mood, battery, music, thought
   - Updates via broadcast
   - Deep links to specific editors
   - Refresh button

2. **AlbumCoverWidgetProvider**
   - Shows album cover (placeholder or user data)
   - Updates via broadcast

3. **PhotoWidgetProvider**
   - Shows photo (Picsum placeholder)
   - Updates via broadcast

## Update Mechanisms

### iOS

- **System-driven**: Timeline Provider with policies
- **App-driven**: `WidgetCenter.reloadTimelines()`
- **Frequency**: 15 min (check-in/album), 1 hour (photo)
- **Reliability**: iOS manages update schedule

### Android

- **App-driven only**: Broadcast intents
- **System-driven**: `APPWIDGET_UPDATE` (add widget, periodic)
- **Frequency**: On-demand via broadcasts
- **Reliability**: App controls all updates

## Logging Comparison

### iOS Logs

```
[WidgetSync] iOS App Group state read by widget:
  auth_csrftokenLen: 32
  auth_accessTokenLen: 64
  checkin_lastSeenMood: happy
  checkin_lastSeenBattery: moderately_social
  ...
```

### Android Logs

```
[WidgetSync] Android diagnostics (parsed from JSON):
  auth_csrftokenLen: 32
  auth_accessTokenLen: 64
  lastSeenMood: happy
  lastSeenBattery: moderately_social
  ...
```

**Similarity**: Both provide comprehensive diagnostics

## Testing Commands

### iOS

```bash
# View App Group data
xcrun simctl get_app_container booted com.whoami.today.app data

# Trigger widget update
# (No direct command - use app or wait for timeline)

# View logs
xcrun simctl spawn booted log stream --predicate 'subsystem contains "com.whoami.today"'
```

### Android

```bash
# View SharedPreferences
adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml

# Trigger widget update
adb shell am broadcast -a com.whoami.today.app.WIDGET_UPDATE

# View logs
adb logcat | grep -E "WidgetDataModule|CheckinWidget|WidgetSync"
```

## Known Differences

### 1. Image Storage

- **iOS**: Binary data in App Group
- **Android**: Base64 strings in SharedPreferences
- **Impact**: Minimal - both work reliably

### 2. Update Timing

- **iOS**: System-controlled timeline + app triggers
- **Android**: App-controlled broadcasts only
- **Impact**: Android requires more explicit updates

### 3. Data Structure

- **iOS**: Flat structure with separate keys
- **Android**: Nested JSON in single key
- **Impact**: None - abstracted by bridge

### 4. Diagnostics Format

- **iOS**: Returns object
- **Android**: Returns JSON string
- **Impact**: None - TypeScript handles both

## Recommendations

### For Production

1. **Monitor both platforms** for sync success rate
2. **Use diagnostics** to debug issues in production
3. **Keep logging** in debug builds, reduce in release
4. **Test edge cases**: logout, version changes, network failures

### For Future Improvements

1. **Unify data structure**: Consider using same JSON format on iOS
2. **Add retry logic**: For failed syncs
3. **Add sync status**: Show user when widget data is stale
4. **Optimize image storage**: Consider compression

## Conclusion

✅ **Feature Parity Achieved**

Both iOS and Android now have:
- Complete data synchronization
- Diagnostics for debugging
- Delayed retry mechanism
- Comprehensive logging
- Shared playlist support

The implementations differ in details but provide equivalent functionality and reliability.
