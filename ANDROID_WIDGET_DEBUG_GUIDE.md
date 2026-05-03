# Android Widget Debugging Guide

This guide helps you debug and verify the Android widget data synchronization fixes.

## Prerequisites

1. Android device or emulator with the app installed
2. USB debugging enabled
3. `adb` command-line tool available

## Step 1: Clear Logs and Start Fresh

```bash
# Clear logcat buffer
adb logcat -c

# Start monitoring logs (run in separate terminal)
adb logcat | grep -E "WidgetDataModule|CheckinWidget|WidgetSync"
```

## Step 2: Check Current Widget State

### View SharedPreferences Data

```bash
# Access app's private storage
adb shell run-as com.whoami.today.app

# View widget preferences file
cat shared_prefs/WhoAmIWidgetPrefs.xml

# Exit shell
exit
```

Expected keys in `WhoAmIWidgetPrefs.xml`:
- `csrftoken` - CSRF token for authentication
- `access_token` - Access token for authentication
- `user_version_type` - User version type (e.g., "default" or other)
- `widget_data` - JSON string containing `my_check_in` object
- `spotify_client_id` - Spotify client ID
- `spotify_client_secret` - Spotify client secret
- `widget_shared_playlist_album_image_base64` - Base64 album image (if shared playlist synced)
- `widget_shared_playlist_avatar_image_base64` - Base64 avatar image (if shared playlist synced)

## Step 3: Trigger Widget Sync from App

### Method A: Update Check-in in App

1. Open the app
2. Update your mood, social battery, music, or thought
3. Watch the logs for:
   ```
   [WidgetSync] WIDGET_DATA_UPDATED received from WebView
   [WidgetSync] syncMyCheckInToWidget called with: ...
   [syncMyCheckIn] START - Syncing check-in data to widget
   [syncMyCheckIn] Final widget_data JSON to save: ...
   [syncMyCheckIn] Data saved to SharedPreferences with commit(): true
   [updateWidgets] Sending immediate widget update broadcast
   [updateWidgetsWithFollowUp] Sending delayed follow-up widget update broadcast
   [onReceive] WIDGET_UPDATE broadcast received
   [updateAppWidget] START - Widget ID: ...
   [updateAppWidget] Raw widget_data from prefs: ...
   [updateAppWidget] Extracted mood: ...
   ```

### Method B: Send App to Background

1. Open the app (make sure you're logged in)
2. Press home button to send app to background
3. Watch for:
   ```
   [AppScreen] App state changed: inactive
   [WidgetSync] State=inactive → triggering runWidgetSync
   [WidgetSync] runWidgetSync called
   [WidgetSync] Fetching profile + song from API…
   ```

### Method C: Bring App to Foreground

1. Open the app from background
2. Watch for:
   ```
   [AppScreen] App state changed: active
   [WidgetSync] State=active → triggering runWidgetSync
   ```

## Step 4: Check Widget Diagnostics

The app now calls `getWidgetDiagnostics()` when returning to foreground. Look for this log:

```
[WidgetSync] Android diagnostics (parsed from JSON): {
  auth_csrftokenLen: 32,
  auth_accessTokenLen: 64,
  userVersionType: "premium",
  widgetDataJsonLen: 250,
  myCheckInRawPresent: true,
  myCheckInDecodeOk: true,
  lastSeenMood: "happy",
  lastSeenBattery: "moderately_social",
  lastSeenDescription: "Feeling good today!",
  lastSeenTrackId: "spotify:track:...",
  lastSeenAlbumImageUrl: "https://...",
  ...
}
```

### Key Indicators:

✅ **Working correctly:**
- `myCheckInRawPresent: true` - Data exists in SharedPreferences
- `myCheckInDecodeOk: true` - JSON parsing succeeded
- `lastSeenMood`, `lastSeenBattery` have values
- `widgetDataJsonLen > 0`

❌ **Problem indicators:**
- `myCheckInRawPresent: false` - No data in SharedPreferences (sync didn't happen)
- `myCheckInDecodeOk: false` - JSON parsing failed (malformed data)
- `auth_accessTokenLen: 0` - Not authenticated (widget will show sign-in screen)
- Empty `lastSeenMood`, `lastSeenBattery` - Data not being extracted properly

## Step 5: Verify Widget UI

1. Go to home screen
2. Check the widget displays:
   - Your current mood emoji (or + if not set)
   - Your social battery emoji (or + if not set)
   - Your music album art (or 🎵 if not set)
   - Your thought text (or + if not set)

## Step 6: Test Widget Refresh Button

1. Tap the refresh icon on the widget
2. Watch logs for:
   ```
   [onReceive] WIDGET_UPDATE broadcast received
   [updateAppWidget] START - Widget ID: ...
   ```

## Common Issues and Solutions

### Issue 1: Widget Shows Empty State (+ buttons)

**Symptoms:**
- Widget shows all + buttons
- App has data when you open it

**Check:**
```bash
# View the actual SharedPreferences content
adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml
```

**Possible causes:**
1. `widget_data` key is missing or empty `{}`
2. `widget_data` has no `my_check_in` object
3. Widget update broadcast not being received

**Solution:**
- Check logs for `[syncMyCheckIn]` - is it being called?
- Check logs for `[onReceive]` - is widget receiving broadcasts?
- Try manually triggering sync by updating check-in in app

### Issue 2: Widget Shows Sign-In Screen

**Symptoms:**
- Widget shows "Sign In" button
- You're logged in the app

**Check:**
```bash
adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml | grep access_token
```

**Possible causes:**
1. `access_token` is missing or empty
2. Tokens not synced to SharedPreferences

**Solution:**
- Check logs for `[syncAuthTokens]`
- Try logging out and back in

### Issue 3: Widget Data is Stale

**Symptoms:**
- Widget shows old data
- App shows current data

**Check diagnostics:**
- Compare `lastSeenMood` in diagnostics with current app state
- Check `diagnosticsTimestamp` to see when widget last read data

**Possible causes:**
1. Widget not receiving update broadcasts
2. Timing issue - widget reads before data is written

**Solution:**
- The new implementation uses `commit()` instead of `apply()` - should fix timing
- Delayed retry (800ms) should ensure data is written
- Check logs for both immediate and follow-up broadcasts

### Issue 4: Album Art Not Loading

**Symptoms:**
- Widget shows 🎵 instead of album art
- Music is set in app

**Check logs for:**
```
[updateAppWidget] Found album image URL from key 'album_image_url': ...
```

**Possible causes:**
1. `album_image_url` is null or empty
2. Network request to load image failed
3. Spotify oEmbed fallback failed

**Solution:**
- Check if `lastSeenAlbumImageUrl` in diagnostics has a value
- Check if `lastSeenTrackId` has a value (for oEmbed fallback)
- Look for network errors in logs

## Step 7: Manual Broadcast Test

If you suspect the widget isn't receiving broadcasts, test manually:

```bash
# Send widget update broadcast manually
adb shell am broadcast -a com.whoami.today.app.WIDGET_UPDATE
```

Watch logs for:
```
[onReceive] WIDGET_UPDATE broadcast received
```

## Step 8: Verify Timing Fix

The new implementation should show:

```
[syncMyCheckIn] Data saved to SharedPreferences with commit(): true
[updateWidgets] Sending immediate widget update broadcast
[onReceive] WIDGET_UPDATE broadcast received (immediate)
[updateAppWidget] Raw widget_data from prefs: {...}  ← Should have data
...
[updateWidgetsWithFollowUp] Sending delayed follow-up widget update broadcast
[onReceive] WIDGET_UPDATE broadcast received (follow-up)
```

The follow-up broadcast (800ms later) ensures data is available even if the first one was too fast.

## Expected Log Flow (Success Case)

```
1. User updates check-in in app:
   [WidgetSync] WIDGET_DATA_UPDATED received from WebView
   [syncMyCheckIn] START - Syncing check-in data to widget
   [syncMyCheckIn] mood: happy
   [syncMyCheckIn] social_battery: moderately_social
   [syncMyCheckIn] Final widget_data JSON to save: {"my_check_in":{...}}
   [syncMyCheckIn] Data saved to SharedPreferences with commit(): true
   [updateWidgets] Sending immediate widget update broadcast

2. Widget receives broadcast:
   [onReceive] WIDGET_UPDATE broadcast received
   [updateAppWidget] START - Widget ID: 123
   [updateAppWidget] Auth state - isAuthenticated: true
   [updateAppWidget] Raw widget_data from prefs: {"my_check_in":{...}}
   [updateAppWidget] Parsed widget_data JSON, has my_check_in: true
   [updateAppWidget] Extracted mood: happy
   [updateAppWidget] Extracted social_battery: moderately_social
   [updateAppWidget] COMPLETE - Widget ID: 123, Elapsed: 45ms

3. Follow-up broadcast (800ms later):
   [updateWidgetsWithFollowUp] Sending delayed follow-up widget update broadcast
   [onReceive] WIDGET_UPDATE broadcast received
   [updateAppWidget] START - Widget ID: 123
   ...
```

## Comparison: Before vs After Fix

### Before (Issues):
- Used `apply()` - asynchronous, data might not be written when widget reads
- Single broadcast - no retry if timing was bad
- No diagnostics - blind debugging
- Missing shared playlist methods

### After (Fixed):
- Uses `commit()` - synchronous, data guaranteed to be written
- Dual broadcast - immediate + 800ms follow-up (like iOS)
- Full diagnostics - can see exactly what widget reads
- Shared playlist methods implemented
- Comprehensive logging throughout

## Next Steps

After verifying Android works correctly, you can:
1. Apply similar fixes to iOS if needed
2. Compare iOS and Android behavior side-by-side
3. Test on multiple Android versions
4. Monitor production logs for any remaining issues
