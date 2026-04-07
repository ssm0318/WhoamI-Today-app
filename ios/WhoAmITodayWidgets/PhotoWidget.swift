import WidgetKit
import SwiftUI
import UIKit

struct PhotoWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let photoData: Data?
    let placeholderImageData: Data?
}

struct PhotoWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PhotoWidgetEntry {
        PhotoWidgetEntry(date: Date(), isAuthenticated: true, isDefaultVersion: false, photoData: nil, placeholderImageData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (PhotoWidgetEntry) -> Void) {
        let entry = PhotoWidgetEntry(
            date: Date(),
            isAuthenticated: SharedDataManager.shared.isAuthenticated,
            isDefaultVersion: SharedDataManager.shared.isDefaultVersion,
            photoData: nil,
            placeholderImageData: nil
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoWidgetEntry>) -> Void) {
        Task {
            let placeholderData = await fetchPlaceholderImage()
            let entry = PhotoWidgetEntry(
                date: Date(),
                isAuthenticated: SharedDataManager.shared.isAuthenticated,
                isDefaultVersion: SharedDataManager.shared.isDefaultVersion,
                photoData: nil,
                placeholderImageData: placeholderData
            )
            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func fetchPlaceholderImage() async -> Data? {
        let size = 400
        guard let url = URL(string: "https://picsum.photos/\(size)/\(size)") else { return nil }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return data
        } catch {
            return nil
        }
    }
}

struct PhotoWidgetView: View {
    let entry: PhotoWidgetEntry

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView()
            } else if entry.isDefaultVersion {
                DefaultVersionView()
            } else {
                photoContent
            }
        }
    }

    @ViewBuilder
    var photoContent: some View {
        if let imageData = entry.photoData, let uiImage = UIImage(data: imageData) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
        } else if let placeholderData = entry.placeholderImageData, let uiImage = UIImage(data: placeholderData) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
        } else {
            VStack(spacing: 8) {
                Text("📷")
                    .font(.system(size: 32))
                Text("Photo")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(white: 0.96))
        }
    }
}

struct PhotoWidget: Widget {
    let kind: String = "PhotoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PhotoWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                PhotoWidgetView(entry: entry)
                    .containerBackground(Color.white, for: .widget)
            } else {
                PhotoWidgetView(entry: entry)
                    .background(Color.white)
            }
        }
        .configurationDisplayName("WhoAmI Photo")
        .description("Display a photo from WhoAmI Today.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
