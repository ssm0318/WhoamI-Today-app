import WidgetKit
import SwiftUI
import UIKit
import os.log

struct CheckinWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let isVersionQ: Bool
    let myCheckIn: MyCheckIn?
    let albumImageData: Data?
}

struct CheckinWidgetProvider: TimelineProvider {
    // Build an entry synchronously from whatever is currently in the App Group.
    // Used by placeholder, getSnapshot, and getTimeline so they all reflect real data.
    private func currentEntry() -> CheckinWidgetEntry {
        let mgr = SharedDataManager.shared
        return CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            isVersionQ: mgr.isVersionQ,
            myCheckIn: mgr.myCheckIn,
            albumImageData: mgr.cachedAlbumImageData
        )
    }

    func placeholder(in context: Context) -> CheckinWidgetEntry {
        currentEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (CheckinWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckinWidgetEntry>) -> Void) {
        let mgr = SharedDataManager.shared
        let isAuth = mgr.isAuthenticated
        let isDefault = mgr.isDefaultVersion
        let isVersionQ = mgr.isVersionQ
        let checkIn = mgr.myCheckIn
        let albumImageData: Data? = mgr.cachedAlbumImageData

        // Hand the fresh entry back to iOS FIRST — every ms of extra work here
        // delays the moment iOS replaces the cached snapshot it shows right after
        // the widget is added. Diagnostics get written after completion.
        let entry = CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: isAuth,
            isDefaultVersion: isDefault,
            isVersionQ: isVersionQ,
            myCheckIn: checkIn,
            albumImageData: albumImageData
        )
        // `.atEnd` tells iOS to ask for the next timeline as soon as this entry
        // finishes displaying, instead of locking us out for 15 min. Combined
        // with the host app's reloadAllTimelines, this lets fresh data overtake
        // the OS-cached snapshot faster on widget add / account switch.
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)

        // Diagnostics (post-completion so they don't gate iOS rendering).
        let rawBytes = mgr.rawMyCheckInBytes
        let rawPreview: String
        if let rawBytes = rawBytes, let rawString = String(data: rawBytes, encoding: .utf8) {
            rawPreview = String(rawString.prefix(240))
        } else {
            rawPreview = ""
        }
        mgr.writeCheckInRawState(
            rawBytesPresent: rawBytes != nil,
            decodeOk: checkIn != nil,
            decodeSource: mgr.myCheckInDecodeSource,
            rawPreview: rawPreview
        )
        mgr.writeDiagnostics(
            mood: checkIn?.mood ?? "(nil)",
            battery: checkIn?.socialBattery ?? "(nil)",
            feelingDisplay: checkIn?.feelingDisplay ?? "(nil)",
            batteryDisplay: checkIn?.batteryDisplay ?? "(nil)"
        )
        mgr.writeWidgetHeartbeat(source: "CheckinWidget.getTimeline")

        let log = OSLog(subsystem: "whoami.widget", category: "CheckinWidget")
        os_log("getTimeline read socialBattery=%{public}@ mood=%{public}@ source=%{public}@ rawBytes=%{public}d decodeOk=%{public}d",
               log: log, type: .info,
               checkIn?.socialBattery ?? "(nil)",
               checkIn?.mood ?? "(nil)",
               mgr.myCheckInDecodeSource,
               rawBytes?.count ?? 0,
               checkIn != nil ? 1 : 0)

        // Fire-and-forget: self-fetch when no data OR when data is incomplete
        // (e.g. App Group has stale entry with nil battery after a clean reinstall).
        let needsApiFetch = checkIn == nil || (checkIn?.batteryDisplay == nil && checkIn?.feelingDisplay == nil)
        if isAuth && !isDefault && !isVersionQ && needsApiFetch {
            Task.detached {
                await Self.fetchCheckInFromApi()
            }
        }

        // Fire-and-forget: refresh the album image cache for the NEXT getTimeline call.
        if isAuth && !isDefault && !isVersionQ, let checkIn = checkIn {
            Task.detached {
                var imageUrl: URL? = nil
                if let urlString = checkIn.albumImageUrl, let url = URL(string: urlString) {
                    imageUrl = url
                } else if !checkIn.trackId.isEmpty {
                    // Spotify oEmbed fallback when only track_id is available
                    imageUrl = await WidgetAPIHelper.fetchSpotifyAlbumImageUrl(trackId: checkIn.trackId)
                }
                if let url = imageUrl {
                    if let data = await WidgetAPIHelper.downloadImageData(from: url) {
                        SharedDataManager.shared.cachedAlbumImageData = data
                    }
                }
            }
        }
    }

    /// Fetch check-in from API, save to App Group, then reload timeline.
    /// Matches Android CheckinWidgetProvider.fetchCheckInFromApi logic.
    private static func fetchCheckInFromApi() async {
        guard let profile = await WidgetAPIHelper.fetchJSON(endpoint: "user/me/profile") else { return }
        guard let apiCheckIn = profile["check_in"] as? [String: Any] else { return }

        // Build my_check_in JSON matching the MyCheckIn Codable model
        var myCheckIn: [String: Any] = [:]
        myCheckIn["id"] = apiCheckIn["id"] as? Int ?? 0
        myCheckIn["is_active"] = apiCheckIn["is_active"] as? Bool ?? false
        myCheckIn["created_at"] = apiCheckIn["created_at"] as? String ?? ""

        // mood: API may return an array of up to 5 emoji strings — pick one at random
        if let moodArray = apiCheckIn["mood"] as? [String] {
            myCheckIn["mood"] = moodArray.randomElement() ?? ""
        } else {
            myCheckIn["mood"] = apiCheckIn["mood"] as? String ?? ""
        }

        // social_battery: nullable
        myCheckIn["social_battery"] = apiCheckIn["social_battery"] as? String

        // API returns "thought", widget expects "description"
        if let thought = apiCheckIn["thought"] as? String {
            myCheckIn["description"] = thought
        } else {
            myCheckIn["description"] = apiCheckIn["description"] as? String ?? ""
        }

        // Default empty track_id
        myCheckIn["track_id"] = ""

        // Fetch active song from check_in/song/ endpoint
        if let songJson = await WidgetAPIHelper.fetchJSON(endpoint: "check_in/song/") {
            let songs: [[String: Any]]
            if let results = songJson["results"] as? [[String: Any]] {
                songs = results
            } else {
                songs = []
            }
            for song in songs {
                if song["is_active"] as? Bool == true {
                    let trackId = song["track_id"] as? String ?? ""
                    if !trackId.isEmpty {
                        myCheckIn["track_id"] = trackId
                        // Get album image URL via Spotify oEmbed
                        if let albumUrl = await WidgetAPIHelper.fetchSpotifyAlbumImageUrl(trackId: trackId) {
                            myCheckIn["album_image_url"] = albumUrl.absoluteString
                            // Cache the album image
                            if let albumData = await WidgetAPIHelper.downloadImageData(from: albumUrl) {
                                WidgetAPIHelper.storeData(albumData, forKey: "widget_album_image")
                            }
                        }
                    }
                    break
                }
            }
        }

        WidgetAPIHelper.storeJSON(myCheckIn, forKey: "my_check_in")
        WidgetCenter.shared.reloadTimelines(ofKind: "CheckinWidgetV3")
    }
}

struct CheckinWidgetView: View {
    let entry: CheckinWidgetEntry

    /// iOS 17+: AppIntent reloads timelines without opening the app. Older OS: deep link opens app to trigger refresh.
    @ViewBuilder
    private var checkinRefreshButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: ReloadCheckinWidgetIntent()) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(Color.gray.opacity(0.7))
                    .frame(width: 24, height: 24)
                    .background(
                        Circle().fill(Color.gray.opacity(0.08))
                    )
            }
            .buttonStyle(.plain)
        } else {
            Link(destination: URL(string: "whoami://widget/refresh-checkin")!) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(Color.gray.opacity(0.7))
                    .frame(width: 24, height: 24)
                    .background(
                        Circle().fill(Color.gray.opacity(0.08))
                    )
            }
        }
    }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView(
                    widgetKind: "CheckinWidgetV3",
                    descriptionText: "Sign in to view your check-in status",
                    layoutStyle: .horizontal
                )
            } else if entry.isAuthenticated && entry.isDefaultVersion {
                DefaultVersionView()
            } else if entry.isVersionQ {
                Color.clear
            } else {
                checkinContent
            }
        }
    }

    var checkinContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header: "My Checkin" left, refresh icon right
            HStack {
                Text("My Checkin")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.black)
                Spacer(minLength: 0)
                checkinRefreshButton
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 6)
            .unredacted()

            Spacer(minLength: 4)

            // Row of 4 equal-width cells aligned to bottom (flex-end)
            GeometryReader { geometry in
                let spacing: CGFloat = 6
                let cellWidth = (geometry.size.width - spacing * 3) / 4
                let boxSize = min(cellWidth - 4, geometry.size.height - 4)
                HStack(spacing: spacing) {
                    CheckInButton(
                        emoji: entry.myCheckIn?.feelingDisplay,
                        description: nil,
                        title: "My Mood",
                        deepLink: "whoami://app/update?editor=mood",
                        boxSize: boxSize
                    )
                    CheckInButton(
                        emoji: entry.myCheckIn?.batteryDisplay,
                        description: nil,
                        title: "My Battery",
                        deepLink: "whoami://app/update?editor=battery",
                        boxSize: boxSize
                    )
                    MusicButton(
                        albumImageData: entry.albumImageData,
                        hasCheckIn: entry.myCheckIn != nil,
                        title: "My Music",
                        deepLink: "whoami://app/update?editor=song",
                        boxSize: boxSize
                    )
                    CheckInButton(
                        emoji: nil,
                        description: entry.myCheckIn?.description,
                        title: "My Thought",
                        deepLink: "whoami://app/update?editor=thought",
                        boxSize: boxSize
                    )
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .unredacted()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct CheckInButton: View {
    let emoji: String?
    let description: String?
    let title: String
    let deepLink: String
    var boxSize: CGFloat = 44

    private var trimmedDescription: String? {
        guard let d = description?.trimmingCharacters(in: .whitespacesAndNewlines), !d.isEmpty else { return nil }
        return d
    }

    var body: some View {
        Link(destination: URL(string: deepLink)!) {
            VStack(spacing: 2) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.purple.opacity(0.15))
                        .frame(width: boxSize, height: boxSize)

                    if let desc = trimmedDescription {
                        VStack(alignment: .leading, spacing: 2) {
                            if let emoji = emoji, !emoji.isEmpty {
                                Text(emoji)
                                    .font(.system(size: min(14, boxSize * 0.32)))
                                    .foregroundColor(.primary)
                            }
                            Text(desc)
                                .font(.system(size: 8))
                                .foregroundColor(.black.opacity(0.75))
                                .lineLimit(3)
                                .multilineTextAlignment(.leading)
                                .minimumScaleFactor(0.85)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(6)
                        .frame(width: boxSize, height: boxSize, alignment: .topLeading)
                    } else if let emoji = emoji, !emoji.isEmpty {
                        Text(emoji)
                            .font(.system(size: min(20, boxSize * 0.45)))
                            .foregroundColor(.primary)
                            .frame(width: boxSize, height: boxSize)
                    } else {
                        Text("+")
                            .font(.system(size: min(20, boxSize * 0.45), weight: .medium))
                            .foregroundColor(.gray)
                            .frame(width: boxSize, height: boxSize)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct MusicButton: View {
    let albumImageData: Data?
    let hasCheckIn: Bool
    let title: String
    let deepLink: String
    var boxSize: CGFloat = 44

    var body: some View {
        Link(destination: URL(string: deepLink)!) {
            VStack(spacing: 2) {
                ZStack(alignment: .topLeading) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.purple.opacity(0.15))
                            .frame(width: boxSize, height: boxSize)

                        if let imageData = albumImageData, let uiImage = UIImage(data: imageData) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: boxSize, height: boxSize)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        } else if hasCheckIn {
                            Text("🎵")
                                .font(.system(size: min(20, boxSize * 0.45)))
                                .foregroundColor(.primary)
                        } else {
                            Text("+")
                                .font(.system(size: min(20, boxSize * 0.45), weight: .medium))
                                .foregroundColor(.gray)
                        }
                    }
                    Image("IconPlaylist")
                        .resizable()
                        .scaledToFit()
                        .frame(width: min(12, boxSize * 0.28), height: min(12, boxSize * 0.28))
                        .padding(4)
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct CheckinWidget: Widget {
    // Bumped from "CheckinWidget" to force iOS to treat this as a brand-new widget
    // and discard all cached snapshots / persisted timeline entries for the old kind.
    let kind: String = "CheckinWidgetV3"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CheckinWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                CheckinWidgetView(entry: entry)
                    .containerBackground(for: .widget) {
                        Color.clear
                    }
            } else {
                CheckinWidgetView(entry: entry)
                    .background(Color.white)
            }
        }
        .configurationDisplayName("WhoAmI Check-in")
        .description("Quick access to your check-in status. Tap + to open check-in edit.")
        .supportedFamilies([.systemMedium])
    }
}
