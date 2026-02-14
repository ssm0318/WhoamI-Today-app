import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), data: .placeholder, isAuthenticated: true, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:])
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        // Prefer freshly synced myCheckIn from App Group so the widget shows updated mood immediately
        let baseData = SharedDataManager.shared.cachedWidgetData ?? .placeholder
        let snapshotData: WidgetData
        if let freshCheckIn = SharedDataManager.shared.myCheckIn {
            print("[Widget] getSnapshot: using fresh myCheckIn from App Group, mood: \(freshCheckIn.mood), id: \(freshCheckIn.id)")
            snapshotData = WidgetData(
                myCheckIn: freshCheckIn,
                friendsWithUpdates: baseData.friendsWithUpdates,
                sharedPlaylists: baseData.sharedPlaylists,
                questionOfDay: baseData.questionOfDay,
                lastUpdated: Date()
            )
        } else {
            print("[Widget] getSnapshot: no fresh myCheckIn, using baseData/cache, mood: \(baseData.myCheckIn?.mood ?? "nil")")
            snapshotData = baseData
        }
        let isAuth = SharedDataManager.shared.isAuthenticated
        NSLog("[Widget] getSnapshot: isAuthenticated=%@, hasCachedWidgetData=%@", String(isAuth), String(SharedDataManager.shared.cachedWidgetData != nil))
        let entry = WidgetEntry(
            date: Date(),
            data: snapshotData,
            isAuthenticated: isAuth,
            albumImageData: nil,
            playlistAlbumImages: [:],
            profileImages: [:]
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        Task {
            var entry: WidgetEntry

            NSLog("[Widget] getTimeline called")
            let hasStoredTokens = SharedDataManager.shared.isAuthenticated
            var tokenValid = false
            if hasStoredTokens {
                tokenValid = await NetworkManager.shared.validateToken()
            }
            NSLog("[Widget] getTimeline hasStoredTokens=%@, tokenValid=%@", String(hasStoredTokens), String(tokenValid))

            if tokenValid {
                do {
                    let data = try await NetworkManager.shared.fetchWidgetData()
                    print("[Widget] Successfully fetched data - friends: \(data.friendsWithUpdates.count), playlists: \(data.sharedPlaylists.count)")

                    // Pre-fetch album image for "My Music"
                    var albumImageData: Data? = nil
                    if let imageUrl = data.myCheckIn?.albumImageUrl,
                       let url = URL(string: imageUrl) {
                        print("[Widget] Fetching my music album image from: \(imageUrl)")
                        do {
                            let (imageData, _) = try await URLSession.shared.data(from: url)
                            albumImageData = imageData
                            print("[Widget] My music album image fetched successfully, size: \(imageData.count) bytes")
                        } catch {
                            print("[Widget] Failed to fetch my music album image: \(error)")
                        }
                    }

                    // Pre-fetch album images for playlist songs using Spotify API
                    var playlistAlbumImages: [String: Data] = [:]
                    for song in data.sharedPlaylists.prefix(5) {
                        guard !song.trackId.isEmpty else { continue }

                        print("[Widget] Fetching album for playlist track: \(song.trackId)")
                        do {
                            let track = try await SpotifyManager.shared.getTrack(trackId: song.trackId)
                            if let albumImageUrl = track.albumImageUrl,
                               let url = URL(string: albumImageUrl) {
                                let (imageData, _) = try await URLSession.shared.data(from: url)
                                playlistAlbumImages[song.trackId] = imageData
                                print("[Widget] Playlist album image fetched for \(song.trackId), size: \(imageData.count) bytes")
                            }
                        } catch {
                            print("[Widget] Failed to fetch playlist album for \(song.trackId): \(error)")
                        }
                    }

                    // Pre-fetch profile images for friends and playlist users
                    var profileImages: [Int: Data] = [:]

                    // Fetch friend profile images
                    for friend in data.friendsWithUpdates.prefix(2) {
                        if let profileImageUrl = friend.profileImage,
                           !profileImageUrl.isEmpty,
                           let url = URL(string: profileImageUrl) {
                            print("[Widget] Fetching profile image for friend \(friend.id)")
                            do {
                                let (imageData, _) = try await URLSession.shared.data(from: url)
                                profileImages[friend.id] = imageData
                                print("[Widget] Friend profile image fetched for \(friend.id), size: \(imageData.count) bytes")
                            } catch {
                                print("[Widget] Failed to fetch friend profile image for \(friend.id): \(error)")
                            }
                        }
                    }

                    // Fetch playlist user profile images
                    for song in data.sharedPlaylists.prefix(5) {
                        print("[Widget] Playlist song: \(song.user.username) (ID: \(song.user.id)), profileImage: \(song.user.profileImage ?? "nil")")

                        if let profileImageUrl = song.user.profileImage,
                           !profileImageUrl.isEmpty,
                           let url = URL(string: profileImageUrl) {
                            // Skip if already fetched (in case same user has multiple songs)
                            if profileImages[song.user.id] == nil {
                                print("[Widget] Fetching profile image for playlist user \(song.user.id) from \(profileImageUrl)")
                                do {
                                    let (imageData, _) = try await URLSession.shared.data(from: url)
                                    profileImages[song.user.id] = imageData
                                    print("[Widget] ✅ Playlist user profile image fetched for \(song.user.id), size: \(imageData.count) bytes")
                                } catch {
                                    print("[Widget] ❌ Failed to fetch playlist user profile image for \(song.user.id): \(error)")
                                }
                            } else {
                                print("[Widget] Profile image for user \(song.user.id) already fetched, skipping")
                            }
                        } else {
                            print("[Widget] ⚠️ No profile image URL for playlist user \(song.user.id)")
                        }
                    }

                    print("[Widget] Total profile images loaded: \(profileImages.count), keys: \(Array(profileImages.keys))")

                    entry = WidgetEntry(date: Date(), data: data, isAuthenticated: true, albumImageData: albumImageData, playlistAlbumImages: playlistAlbumImages, profileImages: profileImages)
                } catch {
                    NSLog("[Widget] Error fetching data (show sign-in): %@", String(describing: error))
                    // Token invalid or API error → show "Please Sign in"
                    entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:])
                }
            } else {
                NSLog("[Widget] Not authenticated → entry with showSignInPrompt (data: nil, isAuthenticated: false)")
                entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:])
            }

            // Refresh every 30s so widget picks up check-in updates sooner when system asks for new timeline
            let nextUpdate = Calendar.current.date(byAdding: .second, value: 30, to: Date())!
            NSLog("[Widget] getTimeline: completed, nextRefresh in 30s, entry isAuth=%@", String(entry.isAuthenticated))
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
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
}

struct WhoAmITodayWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        let _ = NSLog("[Widget] EntryView: isAuthenticated=%@, hasData=%@", String(entry.isAuthenticated), String(entry.data != nil))
        if !entry.isAuthenticated {
            let _ = NSLog("[Widget] EntryView: showing MainWidgetView with showSignInPrompt=true")
            // Same layout as logged-in widget, with "Please Sign in" in the question area
            MainWidgetView(
                data: .empty,
                albumImageData: nil,
                playlistAlbumImages: [:],
                profileImages: [:],
                showSignInPrompt: true
            )
        } else if let data = entry.data {
            // TODO(Gina): MainWidgetView is the main widget view - customize in MainWidgetView.swift
            MainWidgetView(data: data, albumImageData: entry.albumImageData, playlistAlbumImages: entry.playlistAlbumImages, profileImages: entry.profileImages)
        } else {
            PlaceholderView()
        }
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
        .configurationDisplayName("WhoAmI Today")
        .description("Stay connected with friends and discover daily questions.")
        .supportedFamilies([.systemLarge])
    }
}

#Preview(as: .systemLarge) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .placeholder, isAuthenticated: true, albumImageData: nil, playlistAlbumImages: [:], profileImages: [:])
}
