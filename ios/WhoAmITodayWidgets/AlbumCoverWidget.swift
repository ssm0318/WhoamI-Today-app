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
    // ── Debug-only fields, removed after stale-render diagnosis ──
    let debugTrackId: String
    let debugAlbumImageLen: Int
    let debugAppGroupReachable: Bool
    let debugRawJsonPresent: Bool
}

struct AlbumCoverWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> AlbumCoverWidgetEntry {
        // Read real data even in placeholder — iOS sometimes renders the placeholder
        // snapshot on the home screen indefinitely, and we don't want it to freeze the
        // widget at "no data" if the App Group actually has a track ready.
        let mgr = SharedDataManager.shared
        let track = mgr.sharedPlaylistTrack
        let albumImageData = mgr.cachedSharedPlaylistAlbumImage
        let rawBytes = mgr.rawSharedPlaylistTrackBytes
        return AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            albumImageData: albumImageData,
            sharerAvatarData: mgr.cachedSharedPlaylistAvatarImage,
            sharerUsername: track?.sharerUsername,
            debugTrackId: track?.trackId ?? "phNoData",
            debugAlbumImageLen: albumImageData?.count ?? 0,
            debugAppGroupReachable: mgr.appGroupReachable,
            debugRawJsonPresent: rawBytes != nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (AlbumCoverWidgetEntry) -> Void) {
        let mgr = SharedDataManager.shared
        let track = mgr.sharedPlaylistTrack
        let albumImageData = mgr.cachedSharedPlaylistAlbumImage
        let rawBytes = mgr.rawSharedPlaylistTrackBytes

        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            albumImageData: albumImageData,
            sharerAvatarData: mgr.cachedSharedPlaylistAvatarImage,
            sharerUsername: track?.sharerUsername,
            debugTrackId: track?.trackId ?? "snapshotNil",
            debugAlbumImageLen: albumImageData?.count ?? 0,
            debugAppGroupReachable: mgr.appGroupReachable,
            debugRawJsonPresent: rawBytes != nil
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AlbumCoverWidgetEntry>) -> Void) {
        let mgr = SharedDataManager.shared
        let appGroupOk = mgr.appGroupReachable
        let rawBytes = mgr.rawSharedPlaylistTrackBytes
        let track = mgr.sharedPlaylistTrack
        let albumImageData = mgr.cachedSharedPlaylistAlbumImage
        let avatarImageData = mgr.cachedSharedPlaylistAvatarImage

        // Record the exact state the widget saw, so RN can read it back via getWidgetDiagnostics
        var decodeError: String? = nil
        if rawBytes != nil && track == nil {
            decodeError = "json_decode_failed"
        } else if rawBytes == nil {
            decodeError = "no_raw_bytes"
        }

        mgr.writeAlbumDiagnostics(
            trackId: track?.trackId ?? "(nil)",
            sharerUsername: track?.sharerUsername ?? "(nil)",
            albumImageLen: albumImageData?.count ?? 0,
            avatarImageLen: avatarImageData?.count ?? 0,
            decodeError: decodeError
        )

        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            albumImageData: albumImageData,
            sharerAvatarData: avatarImageData,
            sharerUsername: track?.sharerUsername,
            debugTrackId: track?.trackId ?? "nil",
            debugAlbumImageLen: albumImageData?.count ?? 0,
            debugAppGroupReachable: appGroupOk,
            debugRawJsonPresent: rawBytes != nil
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct AlbumCoverWidgetView: View {
    let entry: AlbumCoverWidgetEntry

    private var debugBanner: String {
        let trk = String(entry.debugTrackId.prefix(6))
        let appGrp = entry.debugAppGroupReachable ? "ag1" : "ag0"
        let raw = entry.debugRawJsonPresent ? "raw1" : "raw0"
        // Also read live at render time so we can detect stale cached entries.
        let liveTrk = String((SharedDataManager.shared.sharedPlaylistTrack?.trackId ?? "nil").prefix(6))
        return "v4|\(appGrp)|\(raw)|e:\(trk)|l:\(liveTrk)"
    }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView()
            } else if entry.isDefaultVersion {
                DefaultVersionView()
            } else {
                albumContent
            }
        }
        .overlay(alignment: .topLeading) {
            Text(debugBanner)
                .font(.system(size: 7, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 3)
                .padding(.vertical, 1)
                .background(Color.red.opacity(0.85))
                .padding(2)
                .unredacted()
        }
    }

    @ViewBuilder
    var albumContent: some View {
        Link(destination: URL(string: "whoami://app/discover")!) {
            ZStack(alignment: .topTrailing) {
                // Album art (or placeholder)
                if let imageData = entry.albumImageData, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                } else {
                    VStack(spacing: 8) {
                        Text("🎵")
                            .font(.system(size: 32))
                        Text("Shared Playlist")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.96))
                }

                // Sharer profile avatar overlay (top-trailing) — matches web SharedPlaylistSection
                if let avatarData = entry.sharerAvatarData, let avatarImage = UIImage(data: avatarData) {
                    Image(uiImage: avatarImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 22, height: 22)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .padding(6)
                } else if let username = entry.sharerUsername, let firstChar = username.first {
                    // Fallback: first letter of username on a colored circle
                    Text(String(firstChar).uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(Color.purple))
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .padding(6)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct AlbumCoverWidget: Widget {
    // Bumped from "AlbumCoverWidget" to force iOS to discard all cached snapshots
    // for the old kind.
    let kind: String = "AlbumCoverWidgetV2"

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
