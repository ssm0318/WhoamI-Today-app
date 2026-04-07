---
name: ios-build-archive
description: Steps to build and archive the WhoAmI Today iOS app for TestFlight/App Store. Use when the user wants to build iOS, create an archive, ship to TestFlight, or run fastlane for this project.
---

# iOS Build & Archive (WhoAmI Today)

## Quick reference

- **Workspace**: `ios/whoAmIToday.xcworkspace` (open this in Xcode, not the `.xcodeproj`)
- **Scheme**: `WhoAmIToday`
- **Archive**: Use destination **Any iOS Device (arm64)** before Product → Archive

## Option A: Xcode (manual archive)

1. **Pre-build**

   ```bash
   cd ios
   pod install
   cd ..
   ```

2. **Open in Xcode**

   - Open `ios/whoAmIToday.xcworkspace` (not `whoAmIToday.xcodeproj`).

3. **Archive**
   - Select scheme: **WhoAmIToday**
   - Select destination: **Any iOS Device (arm64)** (or a connected device; do not use a simulator)
   - Menu: **Product → Archive**
   - When Organizer opens: **Distribute App** → App Store Connect / TestFlight as needed

## Option B: Fastlane (automated)

The project has a `beta` lane that builds, archives, and uploads to TestFlight (and bumps build number, runs `pod install`, and commits/pushes).

From repo root:

```bash
cd ios
bundle exec fastlane beta
```

Requires: signed in to App Store Connect (e.g. `koyrkr@gmail.com`), Fastlane configured, and `FASTLANE_ITC_TEAM_NAME` set in the lane (currently "JaeWon Kim").

## Checklist before archive

- [ ] `ios/pod install` has been run after any native/dependency changes
- [ ] Version and build number are correct (Xcode target or Fastfile)
- [ ] Signing & Capabilities use the correct team and provisioning profiles
- [ ] Widget extension (WhoAmITodayWidgetExtension) is part of the same scheme and archives with the app
