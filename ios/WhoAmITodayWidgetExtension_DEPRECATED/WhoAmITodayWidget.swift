// =============================================================================
// DEPRECATED - This widget has been deprecated as of Feb 2026.
// Kept for reference. New widgets are in WhoAmITodayWidgets extension.
// =============================================================================

/*
import WidgetKit
import SwiftUI

extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

struct Provider: TimelineProvider {
    /// Set when we delivered a loading entry; next getTimeline should complete from cache (no loading).
    static var isRefreshFollowUp: Bool = false

    func placeholder(in context: Context) -> WidgetEntry {
        // Use empty so gallery/first frame don't show fake "Matter123" / "User1" placeholders
        WidgetEntry(date: Date(), data: .empty, isAuthenticated: true, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:], isRefreshing: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        // Use cache only if less than 5 minutes old so first add or long idle shows fresh data after getTimeline
        let cache = SharedDataManager.shared.cachedWidgetData
        let cacheAge = cache?.lastUpdated.timeIntervalSinceNow ?? -999
        let useCache = cache != nil && cacheAge > -300
        let isAuth = SharedDataManager.shared.isAuthenticated
        let baseData: WidgetData
        if useCache {
            baseData = cache!
            print("[Widget] getSnapshot: using cache (age \(Int(-cacheAge))s), mood: \(baseData.myCheckIn?.mood ?? "nil")")
        } else if isAuth {
            // First add while logged in: show at least my_check_in from App Group (app already synced); friends/playlists fill in after getTimeline
            let appCheckIn = SharedDataManager.shared.myCheckIn
            baseData = WidgetData(
                myCheckIn: appCheckIn,
                friendsWithUpdates: [],
                sharedPlaylists: [],
                questionOfDay: nil,
                lastUpdated: Date()
            )
            print("[Widget] getSnapshot: no cache, using App Group my_check_in (mood: \(appCheckIn?.mood ?? "nil")) until getTimeline")
        } else {
            baseData = .empty
            print("[Widget] getSnapshot: no cache, not authenticated, using empty")
        }
        let snapshotData: WidgetData
        if let freshCheckIn = SharedDataManager.shared.myCheckIn, useCache {
            snapshotData = WidgetData(
                myCheckIn: freshCheckIn,
                friendsWithUpdates: baseData.friendsWithUpdates,
                sharedPlaylists: baseData.sharedPlaylists,
                questionOfDay: baseData.questionOfDay,
                lastUpdated: Date()
            )
        } else {
            snapshotData = baseData
        }
        let entry = WidgetEntry(
            date: Date(),
            data: snapshotData,
            isAuthenticated: isAuth,
            albumImageData: nil,
            playlistAlbumImages: [:],
            profileImages: [:],
            isRefreshing: false
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        Task {
            let cal = Calendar.current
            let now = Date()
            let startOfToday = cal.startOfDay(for: now)
            let startOfNextDay = cal.date(byAdding: .day, value: 1, to: startOfToday)!

            // Second getTimeline after we showed loading: deliver from cache and exit.
            if Provider.isRefreshFollowUp {
                Provider.isRefreshFollowUp = false
                let cache = SharedDataManager.shared.cachedWidgetData
                let data = cache ?? .empty
                let entry = WidgetEntry(
                    date: Date(),
                    data: cache,
                    isAuthenticated: true,
                    albumImageData: SharedDataManager.shared.cachedAlbumImageData,
                    playlistAlbumImages: SharedDataManager.shared.cachedPlaylistAlbumImages,
                    profileImages: SharedDataManager.shared.cachedProfileImages,
                    isRefreshing: false
                )
                SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: entry.data?.myCheckIn?.mood, lastGetTimelineDate: Date())
                completion(Timeline(entries: [entry], policy: .after(startOfNextDay)))
                return
            }

            var entry: WidgetEntry
            let hasStoredTokens = SharedDataManager.shared.isAuthenticated
            var tokenValid = false
            if hasStoredTokens {
                tokenValid = await NetworkManager.shared.validateToken()
            }

            if tokenValid {
                let cache = SharedDataManager.shared.cachedWidgetData
                // First add (no cache): fetch inline and deliver one entry. No "Refreshing" so widget doesn't stay stuck.
                if cache == nil {
                    do {
                        let data = try await NetworkManager.shared.fetchWidgetData()
                        let (albumImageData, playlistAlbumImages, profileImages) = await fetchAllImages(for: data)
                        let entry = WidgetEntry(
                            date: Date(),
                            data: data,
                            isAuthenticated: true,
                            albumImageData: albumImageData,
                            playlistAlbumImages: playlistAlbumImages,
                            profileImages: profileImages,
                            isRefreshing: false
                        )
                        SharedDataManager.shared.cachedWidgetData = data
                        SharedDataManager.shared.cachedAlbumImageData = albumImageData
                        SharedDataManager.shared.cachedPlaylistAlbumImages = playlistAlbumImages
                        SharedDataManager.shared.cachedProfileImages = profileImages
                        SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: data.myCheckIn?.mood, lastGetTimelineDate: Date())
                        SharedDataManager.shared.synchronizeWidgetCaches()
                        completion(Timeline(entries: [entry], policy: .after(startOfNextDay)))
                    } catch {
                        let entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:], isRefreshing: false)
                        SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: nil, lastGetTimelineDate: Date())
                        completion(Timeline(entries: [entry], policy: .after(startOfNextDay)))
                    }
                    return
                }

                // Have cache (user tapped refresh or widget already loaded): show Refreshing, then fetch in background.
                let loadingData = cache ?? .empty
                let loadingEntry = WidgetEntry(
                    date: Date(),
                    data: loadingData,
                    isAuthenticated: true,
                    albumImageData: SharedDataManager.shared.cachedAlbumImageData,
                    playlistAlbumImages: SharedDataManager.shared.cachedPlaylistAlbumImages,
                    profileImages: SharedDataManager.shared.cachedProfileImages,
                    isRefreshing: true
                )
                completion(Timeline(entries: [loadingEntry], policy: .after(startOfNextDay)))
                Provider.isRefreshFollowUp = true

                Task {
                    await performFetchSaveAndReload()
                }
                return
            }

            // Not authenticated
            entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:], isRefreshing: false)
            SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: entry.data?.myCheckIn?.mood, lastGetTimelineDate: Date())
            completion(Timeline(entries: [entry], policy: .after(startOfNextDay)))
        }
    }

    /// Fetches album + playlist + profile images for the given widget data. Used for both initial load and refresh.
    private func fetchAllImages(for data: WidgetData) async -> (Data?, [String: Data], [Int: Data]) {
        var albumImageData: Data? = nil
        if let imageUrl = data.myCheckIn?.albumImageUrl, let url = URL(string: imageUrl) {
            do {
                let (imageData, _) = try await URLSession.shared.data(from: url)
                albumImageData = imageData
                print("[Widget] My Music album image fetched, size: \(imageData.count)")
            } catch { print("[Widget] Failed to fetch my music album image: \(error)") }
        } else {
            print("[Widget] My Music: no albumImageUrl (trackId: \(data.myCheckIn?.trackId ?? "nil"), Spotify configured: \(SpotifyManager.shared.isConfigured))")
        }

        var playlistAlbumImages: [String: Data] = [:]
        if SpotifyManager.shared.isConfigured {
            for song in data.sharedPlaylists.prefix(5) {
                guard !song.trackId.isEmpty else { continue }
                do {
                    let track = try await SpotifyManager.shared.getTrack(trackId: song.trackId)
                    if let albumImageUrl = track.albumImageUrl, let url = URL(string: albumImageUrl) {
                        let (imageData, _) = try await URLSession.shared.data(from: url)
                        playlistAlbumImages[song.trackId] = imageData
                    }
                } catch { print("[Widget] Playlist album fetch failed for \(song.trackId): \(error)") }
                }
        } else {
            print("[Widget] Spotify not configured in widget - playlist album covers skipped")
        }

        var profileImages: [Int: Data] = [:]
        for friend in data.friendsWithUpdates.prefix(2) {
            if let profileImageUrl = friend.profileImage, !profileImageUrl.isEmpty, let url = URL(string: profileImageUrl) {
                do {
                    let (imageData, _) = try await URLSession.shared.data(from: url)
                    profileImages[friend.id] = imageData
                } catch { _ = () }
            }
        }
        for song in data.sharedPlaylists.prefix(5) {
            if let profileImageUrl = song.user.profileImage, !profileImageUrl.isEmpty, profileImages[song.user.id] == nil,
               let url = URL(string: profileImageUrl) {
                do {
                    let (imageData, _) = try await URLSession.shared.data(from: url)
                    profileImages[song.user.id] = imageData
                } catch { _ = () }
            }
        }
        return (albumImageData, playlistAlbumImages, profileImages)
    }

    private func performFetchSaveAndReload() async {
        do {
            let data = try await NetworkManager.shared.fetchWidgetData()
            print("[Widget] Successfully fetched data (refresh) - friends: \(data.friendsWithUpdates.count), playlists: \(data.sharedPlaylists.count)")
            let (albumImageData, playlistAlbumImages, profileImages) = await fetchAllImages(for: data)

            SharedDataManager.shared.cachedWidgetData = data
            SharedDataManager.shared.cachedAlbumImageData = albumImageData
            SharedDataManager.shared.cachedPlaylistAlbumImages = playlistAlbumImages
            SharedDataManager.shared.cachedProfileImages = profileImages
            SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: data.myCheckIn?.mood, lastGetTimelineDate: Date())
            SharedDataManager.shared.synchronizeWidgetCaches()

            WidgetCenter.shared.reloadTimelines(ofKind: "WhoAmITodayWidget")
        } catch {
            Provider.isRefreshFollowUp = false
            SharedDataManager.shared.setWidgetDiagnostics(lastSeenMood: nil, lastGetTimelineDate: Date())
            WidgetCenter.shared.reloadTimelines(ofKind: "WhoAmITodayWidget")
        }
    }
}

struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
    let isAuthenticated: Bool
    let albumImageData: Data?  // Pre-fetched album image for "My Music"
    let playlistAlbumImages: [String: Data]  // Pre-fetched album images for playlist songs (trackId -> Data)
    let profileImages: [Int: Data]  // Pre-fetched profile images (userId -> Data)
    let isRefreshing: Bool  // true while reloading after user tapped refresh
}

struct WhoAmITodayWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                MainWidgetView(
                    data: .empty,
                    albumImageData: nil,
                    playlistAlbumImages: [:],
                    profileImages: [:],
                    showSignInPrompt: true,
                    isRefreshing: false
                )
            } else if let data = entry.data {
                MainWidgetView(
                    data: data,
                    albumImageData: entry.albumImageData,
                    playlistAlbumImages: entry.playlistAlbumImages,
                    profileImages: entry.profileImages,
                    isRefreshing: entry.isRefreshing
                )
            } else {
                PlaceholderView()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 20)
    }
}

struct WhoAmITodayWidget: Widget {
    let kind: String = "WhoAmITodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                WhoAmITodayWidgetEntryView(entry: entry)
                    .containerBackground(Color.white, for: .widget)
            } else {
                WhoAmITodayWidgetEntryView(entry: entry)
                    .padding()
                    .background(Color.white)
            }
        }
        .contentMarginsDisabledIfAvailable()
        .configurationDisplayName("WhoAmI Today")
        .description("Stay connected with friends and discover daily questions.")
        .supportedFamilies([.systemLarge])
    }
}

#Preview(as: .systemLarge) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .empty, isAuthenticated: true, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:], isRefreshing: false)
}
*/
