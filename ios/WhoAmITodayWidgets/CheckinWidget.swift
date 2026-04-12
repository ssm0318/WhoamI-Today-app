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
    // Build an entry synchronously from whatever is currently in the App Group.
    // Used by placeholder, getSnapshot, and getTimeline so they all reflect real data.
    private func currentEntry() -> CheckinWidgetEntry {
        CheckinWidgetEntry(
            date: Date(),
            isAuthenticated: SharedDataManager.shared.isAuthenticated,
            isDefaultVersion: SharedDataManager.shared.isDefaultVersion,
            myCheckIn: SharedDataManager.shared.myCheckIn,
            albumImageData: SharedDataManager.shared.cachedAlbumImageData
        )
    }

    func placeholder(in context: Context) -> CheckinWidgetEntry {
        // Previously hardcoded myCheckIn: nil, which caused iOS's cached placeholder
        // snapshot to show "checkIn=nil" on the home screen forever. Read real data.
        currentEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (CheckinWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckinWidgetEntry>) -> Void) {
        // Synchronous reads only — the completion is called immediately, avoiding
        // the "Task { … await URLSession } → maybe completion never fires" hazard.
        let isAuth = SharedDataManager.shared.isAuthenticated
        let isDefault = SharedDataManager.shared.isDefaultVersion
        let rawCheckInBytes = SharedDataManager.shared.rawMyCheckInBytes
        let checkIn = SharedDataManager.shared.myCheckIn
        let albumImageData: Data? = SharedDataManager.shared.cachedAlbumImageData

        // Record raw-bytes-present vs decode-success separately so we can tell whether
        // the App Group read failed OR JSON decoding failed when checkIn ends up nil.
        SharedDataManager.shared.writeCheckInRawState(
            rawBytesPresent: rawCheckInBytes != nil,
            decodeOk: checkIn != nil
        )

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

        // Fire-and-forget: refresh the album image cache for the NEXT getTimeline call.
        // Must not block the completion above — iOS may stop rendering if completion is
        // delayed or if the Task gets cancelled.
        if isAuth && !isDefault,
           let checkIn = checkIn,
           let urlString = checkIn.albumImageUrl,
           let url = URL(string: urlString) {
            Task.detached {
                do {
                    let (data, _) = try await URLSession.shared.data(from: url)
                    SharedDataManager.shared.cachedAlbumImageData = data
                } catch {
                    // ignore — best-effort cache update
                }
            }
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
        // Read live data at render time, in addition to the entry iOS passed us.
        // If entry.myCheckIn is nil but live is not, iOS is rendering a stale cached entry.
        let live = SharedDataManager.shared.myCheckIn
        let entryStatus: String
        if let c = entry.myCheckIn {
            entryStatus = "entry:mood='\(c.mood)'"
        } else {
            entryStatus = "entry:nil"
        }
        let liveStatus: String
        if let l = live {
            liveStatus = "live:mood='\(l.mood)'"
        } else {
            liveStatus = "live:nil"
        }
        return "v4 \(entryStatus) \(liveStatus)"
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
