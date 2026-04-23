import WidgetKit
import SwiftUI
import UIKit

extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

struct AlbumCoverWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let isVersionQ: Bool
    let albumImageData: Data?
    let sharerAvatarData: Data?
    let sharerUsername: String?
}

struct AlbumCoverWidgetProvider: TimelineProvider {
    private let appGroup = "group.com.whoami.today.app"

    /// Read image from file in App Group container (bypasses UserDefaults)
    private func readFile(_ name: String) -> Data? {
        guard let url = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
        )?.appendingPathComponent(name) else { return nil }
        return try? Data(contentsOf: url)
    }

    /// Best-effort album image: file first, then UserDefaults/plist fallback
    private func albumImage() -> Data? {
        readFile("shared_playlist_album.bin") ?? SharedDataManager.shared.cachedSharedPlaylistAlbumImage
    }

    private func avatarImage() -> Data? {
        readFile("shared_playlist_avatar.bin") ?? SharedDataManager.shared.cachedSharedPlaylistAvatarImage
    }

    func placeholder(in context: Context) -> AlbumCoverWidgetEntry {
        let mgr = SharedDataManager.shared
        let track = mgr.sharedPlaylistTrack
        return AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            isVersionQ: mgr.isVersionQ,
            albumImageData: albumImage(),
            sharerAvatarData: avatarImage(),
            sharerUsername: track?.sharerUsername
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (AlbumCoverWidgetEntry) -> Void) {
        let mgr = SharedDataManager.shared
        let track = mgr.sharedPlaylistTrack
        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            isVersionQ: mgr.isVersionQ,
            albumImageData: albumImage(),
            sharerAvatarData: avatarImage(),
            sharerUsername: track?.sharerUsername
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AlbumCoverWidgetEntry>) -> Void) {
        let mgr = SharedDataManager.shared
        let isAuth = mgr.isAuthenticated
        let isDefault = mgr.isDefaultVersion
        let isVersionQ = mgr.isVersionQ
        let track = mgr.sharedPlaylistTrack
        // Use file-first fallback helpers so timeline entries reflect App Group files immediately.
        let albumImageData = albumImage()
        let avatarImageData = avatarImage()

        // Debug heartbeat — write what the widget actually sees
        mgr.writeWidgetHeartbeat(source: "AlbumCoverWidget.getTimeline")
        mgr.writeAlbumDiagnostics(
            trackId: track?.trackId ?? "(nil)",
            sharerUsername: track?.sharerUsername ?? "(nil)",
            albumImageLen: albumImageData?.count ?? 0,
            avatarImageLen: avatarImageData?.count ?? 0,
            decodeError: "isAuth=\(isAuth) isDefault=\(isDefault) csrf=\(mgr.csrfToken?.prefix(8) ?? "nil") access=\(mgr.accessToken?.prefix(8) ?? "nil")"
        )

        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: isAuth,
            isDefaultVersion: isDefault,
            isVersionQ: isVersionQ,
            albumImageData: albumImageData,
            sharerAvatarData: avatarImageData,
            sharerUsername: track?.sharerUsername
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)

        // Fire-and-forget: self-fetch when no cached data
        if isAuth && !isDefault && !isVersionQ && albumImageData == nil && avatarImageData == nil {
            Task.detached {
                await Self.fetchSharedPlaylistFromApi()
            }
        }
    }

    /// Fetch shared playlist from API, save to App Group, then reload timeline.
    /// Matches Android AlbumCoverWidgetProvider.fetchSharedPlaylistFromApi logic.
    private static func fetchSharedPlaylistFromApi() async {
        guard let json = await WidgetAPIHelper.fetchJSON(endpoint: "user/discover/?page=1") else { return }
        guard let musicTracks = json["music_tracks"] as? [[String: Any]],
              !musicTracks.isEmpty,
              let picked = musicTracks.randomElement() else { return }

        let trackId = picked["track_id"] as? String ?? ""
        let user = picked["user"] as? [String: Any]
        let sharerUsername = user?["username"] as? String ?? ""
        let profileImageUrl = user?["profile_image"] as? String ?? ""

        // Build shared_playlist_track JSON
        let trackDict: [String: Any] = [
            "id": picked["id"] as? Int ?? 0,
            "track_id": trackId,
            "sharer_username": sharerUsername
        ]
        WidgetAPIHelper.storeJSON(trackDict, forKey: "shared_playlist_track")

        // Fetch album image via Spotify oEmbed
        if !trackId.isEmpty, let albumUrl = await WidgetAPIHelper.fetchSpotifyAlbumImageUrl(trackId: trackId),
           let albumData = await WidgetAPIHelper.downloadImageData(from: albumUrl) {
            WidgetAPIHelper.storeData(albumData, forKey: "widget_shared_playlist_album_image")
        }

        // Download sharer avatar
        if !profileImageUrl.isEmpty, let url = URL(string: profileImageUrl),
           let avatarData = await WidgetAPIHelper.downloadImageData(from: url) {
            WidgetAPIHelper.storeData(avatarData, forKey: "widget_shared_playlist_avatar_image")
        }

        WidgetCenter.shared.reloadTimelines(ofKind: "AlbumCoverWidgetV3")
    }
}

struct AlbumCoverWidgetView: View {
    let entry: AlbumCoverWidgetEntry

    private var mgr: SharedDataManager { SharedDataManager.shared }

    private var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.whoami.today.app")
    }

    /// File first (App Group), then timeline entry, then UserDefaults/plist cache.
    private func resolvedAlbumImageData() -> Data? {
        if let url = containerURL?.appendingPathComponent("shared_playlist_album.bin"),
           let data = try? Data(contentsOf: url), !data.isEmpty {
            return data
        }
        return entry.albumImageData ?? mgr.cachedSharedPlaylistAlbumImage
    }

    private func resolvedAvatarImageData() -> Data? {
        if let url = containerURL?.appendingPathComponent("shared_playlist_avatar.bin"),
           let data = try? Data(contentsOf: url), !data.isEmpty {
            return data
        }
        return entry.sharerAvatarData ?? mgr.cachedSharedPlaylistAvatarImage
    }

    @ViewBuilder
    var body: some View {
        if entry.isVersionQ {
            ZStack(alignment: .topTrailing) {
                Color.clear
                WidgetRefreshButton(kind: "AlbumCoverWidgetV3")
                    .padding(.top, 6)
                    .padding(.trailing, 6)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            mainContent
                .widgetURL(URL(string: "whoami://app/discover"))
        }
    }

    private var mainContent: some View {
        let albumData = resolvedAlbumImageData()
        let albumUIImage = albumData.flatMap { UIImage(data: $0) }
        let avatarData = resolvedAvatarImageData()
        let avatarUIImage = avatarData.flatMap { UIImage(data: $0) }

        return ZStack {
            if !entry.isAuthenticated {
                SignInView(widgetKind: "AlbumCoverWidgetV3", descriptionText: "Sign in to view shared playlist")
            } else if entry.isDefaultVersion {
                DefaultVersionView()
            } else {
                Group {
                    if let img = albumUIImage {
                        Image(uiImage: img)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } else {
                        VStack(spacing: 8) {
                            Text("Shared Playlist")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(white: 0.96))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()

                VStack {
                    HStack {
                        Image("IconPlaylist")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 18, height: 18)

                        Spacer()

                        if let avImg = avatarUIImage {
                            Image(uiImage: avImg)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 32, height: 32)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        } else if UIImage(named: "DefaultProfile") != nil {
                            Image("DefaultProfile")
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 32, height: 32)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        } else if let username = entry.sharerUsername, let firstChar = username.first {
                            Text(String(firstChar).uppercased())
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 32, height: 32)
                                .background(Circle().fill(Color.purple))
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        }
                    }
                    .padding(6)
                    Spacer()
                }

                WidgetRefreshButton(kind: "AlbumCoverWidgetV3")
                    .padding(6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct AlbumCoverWidget: Widget {
    let kind: String = "AlbumCoverWidgetV3"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AlbumCoverWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                AlbumCoverWidgetView(entry: entry)
                    .containerBackground(for: .widget) {
                        Color.clear
                    }
            } else {
                AlbumCoverWidgetView(entry: entry)
                    .background(Color.clear)
            }
        }
        .configurationDisplayName("WhoAmI Shared Playlist")
        .description("A song from your friends' shared playlist.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
