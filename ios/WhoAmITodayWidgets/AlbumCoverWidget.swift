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
            isAuthenticated: true,
            isDefaultVersion: false,
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
            isAuthenticated: true,
            isDefaultVersion: false,
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
        let track = mgr.sharedPlaylistTrack
        let albumImageData = mgr.cachedSharedPlaylistAlbumImage
        let avatarImageData = mgr.cachedSharedPlaylistAvatarImage

        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: isAuth,
            isDefaultVersion: isDefault,
            albumImageData: albumImageData,
            sharerAvatarData: avatarImageData,
            sharerUsername: track?.sharerUsername
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)

        // Fire-and-forget: self-fetch when no cached data
        if isAuth && !isDefault && albumImageData == nil && avatarImageData == nil {
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
              let picked = musicTracks.first else { return }

        let trackId = picked["track_id"] as? String ?? ""
        let user = picked["user"] as? [String: Any]
        let sharerUsername = user?["username"] as? String ?? ""
        let profileImageUrl = user?["profile_image"] as? String ?? user?["profile_pic"] as? String ?? ""

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

        WidgetCenter.shared.reloadTimelines(ofKind: "AlbumCoverWidgetV2")
    }
}

struct AlbumCoverWidgetView: View {
    let entry: AlbumCoverWidgetEntry

    private var mgr: SharedDataManager { SharedDataManager.shared }

    // Read images directly from files in App Group container — bypasses UserDefaults/cfprefsd
    private var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.whoami.today.app")
    }
    private var fileAlbumImage: Data? {
        guard let url = containerURL?.appendingPathComponent("shared_playlist_album.bin") else { return nil }
        return try? Data(contentsOf: url)
    }
    private var fileAvatarImage: Data? {
        guard let url = containerURL?.appendingPathComponent("shared_playlist_avatar.bin") else { return nil }
        return try? Data(contentsOf: url)
    }

    var body: some View {
        Group {
            if let data = fileAlbumImage, let img = UIImage(data: data) {
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Text("Shared Playlist")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.96))
            }
        }
        .overlay(alignment: .topLeading) {
            Image("IconPlaylist")
                .resizable()
                .scaledToFit()
                .frame(width: 18, height: 18)
                .padding(6)
        }
        .overlay(alignment: .topTrailing) {
            avatarOverlay
        }
        .widgetURL(URL(string: "whoami://app/discover"))
    }

    @ViewBuilder
    private var avatarOverlay: some View {
        if let avData = fileAvatarImage, let avImg = UIImage(data: avData) {
            Image(uiImage: avImg)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 24, height: 24)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .padding(6)
        }
    }

    @ViewBuilder
    var albumContent: some View {
        // Try file first, then entry, then SharedDataManager
        let albumImage = fileAlbumImage ?? entry.albumImageData ?? mgr.cachedSharedPlaylistAlbumImage
        let avatarImage = fileAvatarImage ?? entry.sharerAvatarData ?? mgr.cachedSharedPlaylistAvatarImage
        let track = mgr.sharedPlaylistTrack

        Link(destination: URL(string: "whoami://app/discover")!) {
            ZStack {
                // Album art (or placeholder)
                if let imageData = albumImage, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                } else {
                    VStack(spacing: 8) {
                        Text("Shared Playlist")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.96))
                }

                // Playlist icon (top-leading) — matches Android layout
                VStack {
                    HStack {
                        Image("IconPlaylist")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 22, height: 22)
                            .padding(10)
                        Spacer()
                    }
                    Spacer()
                }

                // Sharer profile avatar overlay (top-trailing)
                VStack {
                    HStack {
                        Spacer()
                        if let avatarData = entry.sharerAvatarData, let avatarImage = UIImage(data: avatarData) {
                            Image(uiImage: avatarImage)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 22, height: 22)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                .padding(6)
                        } else if let username = entry.sharerUsername, let firstChar = username.first {
                            Text(String(firstChar).uppercased())
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 22, height: 22)
                                .background(Circle().fill(Color.purple))
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                .padding(6)
                        }
                    }
                    Spacer()
                }
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
                    .containerBackground(Color.white, for: .widget)
            } else {
                AlbumCoverWidgetView(entry: entry)
                    .background(Color.white)
            }
        }
        .configurationDisplayName("WhoAmI Shared Playlist")
        .description("A song from your friends' shared playlist.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
