import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), data: .placeholder, isAuthenticated: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let entry = WidgetEntry(
            date: Date(),
            data: SharedDataManager.shared.cachedWidgetData ?? .placeholder,
            isAuthenticated: SharedDataManager.shared.isAuthenticated
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        Task {
            var entry: WidgetEntry

            if SharedDataManager.shared.isAuthenticated {
                do {
                    let data = try await NetworkManager.shared.fetchWidgetData()
                    entry = WidgetEntry(date: Date(), data: data, isAuthenticated: true)
                } catch {
                    // Use cached data on error
                    entry = WidgetEntry(
                        date: Date(),
                        data: SharedDataManager.shared.cachedWidgetData ?? .empty,
                        isAuthenticated: true
                    )
                }
            } else {
                entry = WidgetEntry(date: Date(), data: nil, isAuthenticated: false)
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
}

struct WhoAmITodayWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if !entry.isAuthenticated {
            LoginPromptView()
        } else if let data = entry.data {
            switch family {
            case .systemSmall:
                SmallWidgetView(data: data)
            case .systemMedium:
                MediumWidgetView(data: data)
            case .systemLarge:
                LargeWidgetView(data: data)
            default:
                MediumWidgetView(data: data)
            }
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
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                WhoAmITodayWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("WhoAmI Today")
        .description("Stay connected with friends and discover daily questions.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

#Preview(as: .systemSmall) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .placeholder, isAuthenticated: true)
}

#Preview(as: .systemMedium) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .placeholder, isAuthenticated: true)
}

#Preview(as: .systemLarge) {
    WhoAmITodayWidget()
} timeline: {
    WidgetEntry(date: .now, data: .placeholder, isAuthenticated: true)
}
