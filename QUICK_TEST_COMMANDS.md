# Quick Test Commands - Android Widget

## 1. Start Monitoring Logs

```bash
adb logcat -c && adb logcat | grep -E "WidgetDataModule|CheckinWidget|WidgetSync"
```

## 2. View SharedPreferences

```bash
adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml
```

## 3. Manual Widget Update

```bash
adb shell am broadcast -a com.whoami.today.app.WIDGET_UPDATE
```

## 4. Check Widget IDs

```bash
adb shell dumpsys appwidget | grep -A 20 "com.whoami.today.app"
```

## 5. Force Stop and Restart App

```bash
adb shell am force-stop com.whoami.today.app
adb shell am start -n com.whoami.today.app/.MainActivity
```

## 6. Clear App Data (Nuclear Option)

```bash
adb shell pm clear com.whoami.today.app
```

## What to Look For in Logs

### ✅ Good Signs:
```
[syncMyCheckIn] Data saved to SharedPreferences with commit(): true
[updateWidgets] Sending immediate widget update broadcast
[onReceive] WIDGET_UPDATE broadcast received
[updateAppWidget] Parsed widget_data JSON, has my_check_in: true
[updateAppWidget] Extracted mood: happy
```

### ❌ Bad Signs:
```
[syncMyCheckIn] Data saved to SharedPreferences with commit(): false
[updateAppWidget] No my_check_in in widget_data
[updateAppWidget] Error parsing widget data
myCheckInRawPresent: false
myCheckInDecodeOk: false
```

## Quick Diagnostics Check

Look for this log when app comes to foreground:
```
[WidgetSync] Android diagnostics (parsed from JSON)
```

Key fields:
- `auth_accessTokenLen` > 0 → Authenticated
- `myCheckInRawPresent: true` → Data exists
- `myCheckInDecodeOk: true` → Data is valid
- `lastSeenMood`, `lastSeenBattery` → Should match app

## Test Scenarios

### Scenario 1: Update Check-in
1. Open app
2. Change mood/battery/music/thought
3. Watch logs for sync
4. Go to home screen
5. Verify widget updated

### Scenario 2: Background Sync
1. Open app (logged in)
2. Press home button
3. Watch for "State=inactive → triggering runWidgetSync"
4. Check widget updated

### Scenario 3: Foreground Sync
1. App in background
2. Tap app icon
3. Watch for "State=active → triggering runWidgetSync"
4. Check diagnostics logged

### Scenario 4: Widget Refresh
1. Tap refresh icon on widget
2. Watch for broadcast received
3. Verify widget updates

## One-Liner for Full Debug Session

```bash
# Terminal 1: Logs
adb logcat -c && adb logcat | grep -E "WidgetDataModule|CheckinWidget|WidgetSync" | tee widget_debug.log

# Terminal 2: SharedPreferences watch
watch -n 2 'adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml'
```

## Expected Timeline

```
T+0ms:    User updates check-in
T+10ms:   [syncMyCheckIn] START
T+20ms:   [syncMyCheckIn] Data saved with commit(): true
T+25ms:   [updateWidgets] Sending immediate widget update broadcast
T+30ms:   [onReceive] WIDGET_UPDATE broadcast received
T+50ms:   [updateAppWidget] COMPLETE
T+825ms:  [updateWidgetsWithFollowUp] Sending delayed follow-up
T+830ms:  [onReceive] WIDGET_UPDATE broadcast received (follow-up)
```

## Troubleshooting Commands

### Widget not updating?
```bash
# Check if widget is registered
adb shell dumpsys appwidget | grep CheckinWidgetProvider

# Check if broadcasts work
adb shell am broadcast -a com.whoami.today.app.WIDGET_UPDATE

# Check app permissions
adb shell dumpsys package com.whoami.today.app | grep permission
```

### Data not syncing?
```bash
# Check if file exists
adb shell run-as com.whoami.today.app ls -la shared_prefs/

# Check file permissions
adb shell run-as com.whoami.today.app ls -la shared_prefs/WhoAmIWidgetPrefs.xml

# Read raw content
adb shell run-as com.whoami.today.app cat shared_prefs/WhoAmIWidgetPrefs.xml | grep widget_data
```

### App crashing?
```bash
# Get crash logs
adb logcat -d | grep -E "AndroidRuntime|FATAL"

# Get Java stack trace
adb logcat -d | grep -A 50 "FATAL EXCEPTION"
```
