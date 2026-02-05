import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), data: .placeholder, isAuthenticated: true, albumImageData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let entry = WidgetEntry(
            date: Date(),
            data: SharedDataManager.shared.cachedWidgetData ?? .placeholder,
            isAuthenticated: SharedDataManager.shared.isAuthenticated,
            albumImageData: nil
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        Task {
            var entry: WidgetEntry

            print("[Widget] getTimeline called")
            print("[Widget] isAuthenticated: \(SharedDataManager.shared.isAuthenticated)")

            if SharedDataManager.shared.isAuthenticated {
                do {
                    let data = try await NetworkManager.shared.fetchWidgetData()
                    print("[Widget] Successfully fetched data - friends: \(data.friendsWithUpdates.count), playlists: \(data.sharedPlaylists.count)")

                    // Pre-fetch album image if available
                    var albumImageData: Data? = nil
                    if let imageUrl = data.myCheckIn?.albumImageUrl,
                       let url = URL(string: imageUrl) {
                        print("[Widget] Fetching album image from: \(imageUrl)")
                        do {
                            let (imageData, _) = try await URLSession.shared.data(from: url)
                            albumImageData = imageData
                            print("[Widget] Album image fetched successfully, size: \(imageData.count) bytes")
                        } catch {
                            print("[Widget] Failed to fetch album image: \(error)")
                        }
                    }

                    entry = WidgetEntry(date: Date(), data: data, isAuthenticated: true, albumImageData: albumImageData)
                } catch {
                    print("[Widget] Error fetching data: \(error)")
                    // Use cached data on error
                    let cached = SharedDataManager.shared.cachedWidgetData
                    print("[Widget] Using cached data: \(cached != nil)")
                    entry = WidgetEntry(
                        date: Date(),
                        data: cached ?? .empty,
                        isAuthenticated: true,
                        albumImageData: nil
                    )
                }
            } else {
                print("[Widget] Not authenticated, showing login prompt")
                entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false, albumImageData: nil)
            }

            // Refresh every 30 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
    let isAuthenticated: Bool
    let albumImageData: Data?  // Pre-fetched album image
}

struct WhoAmITodayWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        if !entry.isAuthenticated {
            LoginPromptView()
        } else if let data = entry.data {
            // TODO(Gina): MainWidgetView is the main widget view - customize in MainWidgetView.swift
            MainWidgetView(data: data, albumImageData: entry.albumImageData)
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
        // TODO(Gina): Only .systemLarge size is supported - change here if you want other sizes
        .supportedFamilies([.systemLarge])
    }
}

#Preview(as: .systemLarge) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .placeholder, isAuthenticated: true, albumImageData: nil)
}
