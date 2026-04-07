import WidgetKit
import SwiftUI
import UIKit
import os

private let widgetLogger = Logger(subsystem: "com.whoami.today.app.widgets", category: "CheckinWidget")

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
    func placeholder(in context: Context) -> CheckinWidgetEntry {
        CheckinWidgetEntry(date: Date(), isAuthenticated: true, isDefaultVersion: false, myCheckIn: nil, albumImageData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (CheckinWidgetEntry) -> Void) {
        let entry = CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: SharedDataManager.shared.isAuthenticated,
            isDefaultVersion: SharedDataManager.shared.isDefaultVersion,
            myCheckIn: SharedDataManager.shared.myCheckIn,
            albumImageData: SharedDataManager.shared.cachedAlbumImageData
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckinWidgetEntry>) -> Void) {
        Task {
            let isAuth = SharedDataManager.shared.isAuthenticated
            let isDefault = SharedDataManager.shared.isDefaultVersion
            let checkIn = SharedDataManager.shared.myCheckIn
            var albumImageData: Data? = SharedDataManager.shared.cachedAlbumImageData

            // Diagnostic logging — figure out why mood/battery render as "?" boxes
            if let c = checkIn {
                let moodScalars = c.mood.unicodeScalars.map { String(format: "U+%04X", $0.value) }.joined(separator: " ")
                let battScalars = (c.socialBattery ?? "").unicodeScalars.map { String(format: "U+%04X", $0.value) }.joined(separator: " ")
                widgetLogger.notice("getTimeline: id=\(c.id, privacy: .public) mood='\(c.mood, privacy: .public)' [\(moodScalars, privacy: .public)] feelingDisplay='\(c.feelingDisplay ?? "nil", privacy: .public)' batt='\(c.socialBattery ?? "nil", privacy: .public)' [\(battScalars, privacy: .public)] batteryDisplay='\(c.batteryDisplay ?? "nil", privacy: .public)' descLen=\(c.description.count, privacy: .public) trackId='\(c.trackId, privacy: .public)' albumUrl='\(c.albumImageUrl ?? "nil", privacy: .public)'")
                SharedDataManager.shared.writeDiagnostics(
                    mood: c.mood,
                    battery: c.socialBattery ?? "nil",
                    feelingDisplay: c.feelingDisplay ?? "nil",
                    batteryDisplay: c.batteryDisplay ?? "nil"
                )
            } else {
                widgetLogger.notice("getTimeline: myCheckIn=nil isAuth=\(isAuth, privacy: .public) isDefault=\(isDefault, privacy: .public)")
                SharedDataManager.shared.writeDiagnostics(
                    mood: "(nil checkIn)",
                    battery: "(nil checkIn)",
                    feelingDisplay: "(nil checkIn)",
                    batteryDisplay: "(nil checkIn)"
                )
            }

            if isAuth && !isDefault {
                if let checkIn = checkIn,
                   let urlString = checkIn.albumImageUrl,
                   let url = URL(string: urlString) {
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        albumImageData = data
                        SharedDataManager.shared.cachedAlbumImageData = data
                    } catch {
                        widgetLogger.error("Failed to fetch album image: \(error.localizedDescription, privacy: .public)")
                    }
                }
            }

            let entry = CheckinWidgetEntry(
                date: Date(),
                isAuthenticated: isAuth,
                isDefaultVersion: isDefault,
                myCheckIn: checkIn,
                albumImageData: albumImageData
            )

            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct CheckinWidgetView: View {
    let entry: CheckinWidgetEntry

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView()
            } else if entry.isDefaultVersion {
                DefaultVersionView()
            } else {
                checkinContent
            }
        }
    }

    private var debugMoodText: String {
        guard let c = entry.myCheckIn else { return "DBG: checkIn=nil" }
        let scalars = c.mood.unicodeScalars.map { String(format: "%04X", $0.value) }.joined(separator: ".")
        return "DBG: mood='\(c.mood)' [\(scalars)] disp='\(c.feelingDisplay ?? "nil")'"
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
            .padding(.bottom, 2)
            .unredacted()

            // TEMP DEBUG STRIP — remove after diagnosis
            Text(debugMoodText)
                .font(.system(size: 7))
                .foregroundColor(.red)
                .lineLimit(1)
                .truncationMode(.middle)
                .padding(.horizontal, 4)
                .padding(.bottom, 4)
                .unredacted()

            Spacer(minLength: 4)

            // Row of 3 equal-width cells aligned to bottom (flex-end)
            GeometryReader { geometry in
                let spacing: CGFloat = 6
                let cellWidth = (geometry.size.width - spacing * 2) / 3
                let boxSize = min(cellWidth - 4, geometry.size.height - 4)
                HStack(spacing: spacing) {
                    CheckInButton(
                        emoji: entry.myCheckIn?.feelingDisplay,
                        description: entry.myCheckIn?.description,
                        title: "I feel",
                        deepLink: "whoami://app/check-in/edit",
                        boxSize: boxSize
                    )
                    CheckInButton(
                        emoji: entry.myCheckIn?.batteryDisplay,
                        description: nil,
                        title: "My Battery",
                        deepLink: "whoami://app/check-in/edit",
                        boxSize: boxSize
                    )
                    MusicButton(
                        albumImageData: entry.albumImageData,
                        hasCheckIn: entry.myCheckIn != nil,
                        title: "My Music",
                        deepLink: "whoami://app/check-in/edit",
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

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(.black)
                    .lineLimit(1)
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

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(.black)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct CheckinWidget: Widget {
    let kind: String = "CheckinWidget"

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
