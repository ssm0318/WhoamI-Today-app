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
}

struct AlbumCoverWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> AlbumCoverWidgetEntry {
        AlbumCoverWidgetEntry(date: Date(), isAuthenticated: true, isDefaultVersion: false, albumImageData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (AlbumCoverWidgetEntry) -> Void) {
        let entry = AlbumCoverWidgetEntry(
            date: Date(),
            isAuthenticated: SharedDataManager.shared.isAuthenticated,
            isDefaultVersion: SharedDataManager.shared.isDefaultVersion,
            albumImageData: SharedDataManager.shared.cachedAlbumImageData
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AlbumCoverWidgetEntry>) -> Void) {
        Task {
            let isAuth = SharedDataManager.shared.isAuthenticated
            let isDefault = SharedDataManager.shared.isDefaultVersion
            var albumImageData: Data? = SharedDataManager.shared.cachedAlbumImageData

            if isAuth && !isDefault {
                if let checkIn = SharedDataManager.shared.myCheckIn,
                   let urlString = checkIn.albumImageUrl,
                   let url = URL(string: urlString) {
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        albumImageData = data
                        SharedDataManager.shared.cachedAlbumImageData = data
                    } catch {
                        print("[AlbumCoverWidget] Failed to fetch album image: \(error)")
                    }
                }
            }

            let entry = AlbumCoverWidgetEntry(
                date: Date(),
                isAuthenticated: isAuth,
                isDefaultVersion: isDefault,
                albumImageData: albumImageData
            )

            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct AlbumCoverWidgetView: View {
    let entry: AlbumCoverWidgetEntry

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
    }

    @ViewBuilder
    var albumContent: some View {
        if let imageData = entry.albumImageData, let uiImage = UIImage(data: imageData) {
            Link(destination: URL(string: "whoami://app/check-in/edit")!) {
                ZStack(alignment: .topLeading) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                    Image("IconPlaylist")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 22, height: 22)
                        .padding(10)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Link(destination: URL(string: "whoami://app/check-in/edit")!) {
                ZStack(alignment: .topLeading) {
                    VStack(spacing: 8) {
                        Text("🎵")
                            .font(.system(size: 32))
                        Text("My Music")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.96))
                    Image("IconPlaylist")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 22, height: 22)
                        .padding(10)
                }
            }
        }
    }
}

struct AlbumCoverWidget: Widget {
    let kind: String = "AlbumCoverWidget"

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
        .configurationDisplayName("WhoAmI Album")
        .description("Display your check-in album cover.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
