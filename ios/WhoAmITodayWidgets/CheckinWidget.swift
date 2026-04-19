import WidgetKit
import SwiftUI
import UIKit

extension View {
    @ViewBuilder
    func unaccentedEmoji() -> some View {
        if #available(iOS 16.0, *) {
            self.unaccentedEmoji()
        } else {
            self
        }
    }
}

struct CheckinWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let myCheckIn: MyCheckIn?
    let albumImageData: Data?
}

struct CheckinWidgetProvider: TimelineProvider {
    // Build an entry synchronously from whatever is currently in the App Group.
    // Used by placeholder, getSnapshot, and getTimeline so they all reflect real data.
    private func currentEntry(forceAuth: Bool = false) -> CheckinWidgetEntry {
        let mgr = SharedDataManager.shared
        return CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: forceAuth ? true : mgr.isAuthenticated,
            isDefaultVersion: forceAuth ? false : mgr.isDefaultVersion,
            myCheckIn: mgr.myCheckIn,
            albumImageData: mgr.cachedAlbumImageData
        )
    }

    func placeholder(in context: Context) -> CheckinWidgetEntry {
        currentEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (CheckinWidgetEntry) -> Void) {
        // Show content in snapshot; real auth checked in getTimeline
        completion(currentEntry(forceAuth: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckinWidgetEntry>) -> Void) {
        let isAuth = SharedDataManager.shared.isAuthenticated
        let isDefault = SharedDataManager.shared.isDefaultVersion
        let checkIn = SharedDataManager.shared.myCheckIn
        let albumImageData: Data? = SharedDataManager.shared.cachedAlbumImageData

        let entry = CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: isAuth,
            isDefaultVersion: isDefault,
            myCheckIn: checkIn,
            albumImageData: albumImageData
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)

        // Fire-and-forget: self-fetch check-in from API when no cached data
        if isAuth && !isDefault && checkIn == nil {
            Task.detached {
                await Self.fetchCheckInFromApi()
            }
        }

        // Fire-and-forget: refresh the album image cache for the NEXT getTimeline call.
        if isAuth && !isDefault, let checkIn = checkIn {
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

        // mood: API may return array of emoji strings — take first
        if let moodArray = apiCheckIn["mood"] as? [String] {
            myCheckIn["mood"] = moodArray.first ?? ""
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
        WidgetCenter.shared.reloadTimelines(ofKind: "CheckinWidgetV2")
    }
}

struct CheckinWidgetView: View {
    let entry: CheckinWidgetEntry

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView(descriptionText: "Sign in to view your check-in status")
            } else if entry.isDefaultVersion {
                DefaultVersionView()
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
                Link(destination: URL(string: "whoami://widget/refresh-checkin")!) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(Color.gray.opacity(0.5))
                }
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
                                    .unaccentedEmoji()
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
                            .unaccentedEmoji()
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
                                .unaccentedEmoji()
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
    let kind: String = "CheckinWidgetV2"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CheckinWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                CheckinWidgetView(entry: entry)
                    .containerBackground(Color.white, for: .widget)
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
