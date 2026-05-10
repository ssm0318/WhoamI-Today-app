import WidgetKit
import SwiftUI
import UIKit

private let photoWidgetKind = "PhotoWidgetV2"

struct PhotoWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let isVersionQ: Bool
    let friendUpdate: FriendUpdate?
    let contentImageData: Data?
    let profileImageData: Data?
}

struct PhotoWidgetProvider: TimelineProvider {
    private func currentEntry(source: String = "unknown") -> PhotoWidgetEntry {
        let mgr = SharedDataManager.shared
        let friendUpdate = mgr.friendUpdate
        let rawData = mgr.rawFriendUpdateBytes
        let rawString = rawData.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let diagnostic = """
        source=\(source)
        isAuthenticated=\(mgr.isAuthenticated)
        isDefaultVersion=\(mgr.isDefaultVersion)
        isVersionQ=\(mgr.isVersionQ)
        friendUpdateDecoded=\(friendUpdate != nil)
        friendUpdateKind=\(friendUpdate?.kind.rawValue ?? "nil")
        rawJsonLen=\(rawString.count)
        rawJsonPreview=\(String(rawString.prefix(200)))
        """
        let d = UserDefaults(suiteName: "group.com.whoami.today.app")
        d?.set(diagnostic, forKey: "photo_widget_last_render_diag")
        d?.set(ISO8601DateFormatter().string(from: Date()), forKey: "photo_widget_last_render_at")
        mgr.writeWidgetHeartbeat(source: "PhotoWidget.\(source)")
        return PhotoWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            isVersionQ: mgr.isVersionQ,
            friendUpdate: friendUpdate,
            contentImageData: mgr.cachedFriendUpdateContentImage,
            profileImageData: mgr.cachedFriendUpdateProfileImage
        )
    }

    func placeholder(in context: Context) -> PhotoWidgetEntry {
        currentEntry(source: "placeholder")
    }

    func getSnapshot(in context: Context, completion: @escaping (PhotoWidgetEntry) -> Void) {
        completion(currentEntry(source: "snapshot"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoWidgetEntry>) -> Void) {
        let entry = currentEntry(source: "timeline")
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 10, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)

        // Always fetch on each timeline tick so the widget can surface a
        // friend's update without the user having to open the app first.
        // Render returns immediately with the cached entry above; the fetch
        // writes new data to App Group storage and reloads the timeline,
        // producing a quick second render with the fresh content.
        if entry.isAuthenticated && !entry.isDefaultVersion && !entry.isVersionQ {
            Task.detached {
                await Self.fetchFriendUpdateFromApi()
            }
        }
    }

    /// Fetch friend update from API, save to App Group, then reload timeline.
    /// Mirrors Android PhotoWidgetProvider.fetchFriendUpdateFromApi.
    private static func fetchFriendUpdateFromApi() async {
        guard let json = await WidgetAPIHelper.fetchJSON(endpoint: "user/friends/?type=all") else { return }
        guard let results = json["results"] as? [[String: Any]] else { return }

        let candidates: [[String: Any]] = results.filter { friend in
            guard let ts = friend["last_updated_at"] as? String else { return false }
            return !ts.isEmpty
        }

        guard !candidates.isEmpty,
              let picked = candidates.max(by: {
                  ($0["last_updated_at"] as? String ?? "") < ($1["last_updated_at"] as? String ?? "")
              }) else { return }
        let username = picked["username"] as? String ?? ""
        let profileImageUrl = picked["profile_image"] as? String ?? ""

        let preferPost = (picked["last_updated_kind"] as? String) == "post"

        var payload: [String: Any] = ["friend": ["username": username]]
        var contentImageUrl: URL? = nil

        if preferPost,
           let posts = picked["recent_posts"] as? [[String: Any]],
           let post = posts.first {
            let images = post["images"] as? [String] ?? []
            let hasImage = !images.isEmpty
            payload["kind"] = "post"
            payload["post"] = [
                "id": post["id"] as? Int ?? 0,
                "content": post["content"] as? String ?? "",
                "has_image": hasImage
            ]
            if hasImage, let first = images.first, let url = URL(string: first) {
                contentImageUrl = url
            }
        } else if let field = picked["last_updated_field"] as? String {
            var checkin: [String: Any] = [:]
            var ok = false
            switch field {
            case "mood":
                if let arr = picked["mood"] as? [String], let m = arr.randomElement(), !m.isEmpty {
                    checkin["variation"] = "mood"
                    checkin["mood"] = m
                    ok = true
                } else if let m = picked["mood"] as? String, !m.isEmpty {
                    checkin["variation"] = "mood"
                    checkin["mood"] = m
                    ok = true
                }
            case "social_battery":
                if let b = picked["social_battery"] as? String, !b.isEmpty {
                    checkin["variation"] = "social_battery"
                    checkin["social_battery"] = b
                    ok = true
                }
            case "thought":
                if let t = picked["thought"] as? String, !t.isEmpty {
                    checkin["variation"] = "thought"
                    checkin["description"] = t
                    ok = true
                }
            case "song":
                if let trackId = picked["track_id"] as? String, !trackId.isEmpty {
                    checkin["variation"] = "album"
                    checkin["track_id"] = trackId
                    ok = true
                    if let albumUrl = await WidgetAPIHelper.fetchSpotifyAlbumImageUrl(trackId: trackId) {
                        contentImageUrl = albumUrl
                    }
                }
            default:
                break
            }
            guard ok else { return }
            payload["kind"] = "checkin"
            payload["checkin"] = checkin
        } else {
            return
        }

        WidgetAPIHelper.storeJSON(payload, forKey: "friend_update")

        if !profileImageUrl.isEmpty, let url = URL(string: profileImageUrl),
           let data = await WidgetAPIHelper.downloadImageData(from: url) {
            WidgetAPIHelper.storeData(data, forKey: "widget_friend_update_profile_image")
        }

        if let url = contentImageUrl,
           let data = await WidgetAPIHelper.downloadImageData(from: url) {
            WidgetAPIHelper.storeData(data, forKey: "widget_friend_update_content_image")
        }

        WidgetCenter.shared.reloadTimelines(ofKind: photoWidgetKind)
    }
}

struct PhotoWidgetView: View {
    let entry: PhotoWidgetEntry

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                SignInView(widgetKind: photoWidgetKind, descriptionText: "Sign in to see the latest updates from your friends")
            } else if entry.isDefaultVersion {
                DefaultVersionView()
            } else if entry.isVersionQ {
                ZStack(alignment: .topTrailing) {
                    Color.clear
                    WidgetRefreshButton(kind: photoWidgetKind)
                        .padding(.top, 6)
                        .padding(.trailing, 6)
                }
            } else {
                photoContent
            }
        }
    }

    @ViewBuilder
    var photoContent: some View {
        GeometryReader { geometry in
            let side = min(geometry.size.width, geometry.size.height)
            ZStack {
                contentView
                    .frame(width: side, height: side)
                    .clipped()
                profileAvatar
                    .frame(width: side, height: side, alignment: .topTrailing)
                WidgetRefreshButton(kind: photoWidgetKind)
                    .padding(6)
                    .frame(width: side, height: side, alignment: .bottomLeading)
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "whoami://app/friends"))
    }

    @ViewBuilder
    var contentView: some View {
        if let update = entry.friendUpdate {
            switch update.kind {
            case .post:
                postContent(update.post)
            case .checkin:
                checkinContent(update.checkin)
            }
        } else {
            emptyState
        }
    }

    @ViewBuilder
    private func postContent(_ post: FriendUpdate.Post?) -> some View {
        if let post = post, post.hasImage,
           let imageData = entry.contentImageData,
           let uiImage = UIImage(data: imageData) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
        } else if let post = post {
            let trimmed = post.content.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                textContent(trimmed)
            } else {
                emptyState
            }
        } else {
            emptyState
        }
    }

    @ViewBuilder
    private func checkinContent(_ checkin: FriendUpdate.Checkin?) -> some View {
        if let checkin = checkin {
            switch checkin.variation {
            case .album:
                if let imageData = entry.contentImageData, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                } else {
                    emojiCenter("🎵")
                }
            case .mood:
                emojiCenter(checkin.mood ?? "")
            case .socialBattery:
                emojiCenter(batteryEmoji(checkin.socialBattery ?? ""))
            case .thought:
                textContent((checkin.description ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
            }
        } else {
            emptyState
        }
    }

    private func textContent(_ text: String) -> some View {
        VStack {
            Spacer()
            Text(text)
                .font(.system(size: 11))
                .foregroundColor(Color(white: 0.2))
                .lineLimit(4)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 10)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }

    private func emojiCenter(_ emoji: String) -> some View {
        ZStack {
            Color.white
            Text(emoji).font(.system(size: 48))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func batteryEmoji(_ battery: String) -> String {
        switch battery.lowercased() {
        case "super_social": return "🤩"
        case "fully_charged": return "🚀"
        case "moderately_social": return "🔋"
        case "needs_recharge": return "🔌"
        case "low": return "🪫"
        case "completely_drained": return "💤"
        default: return battery
        }
    }

    @ViewBuilder
    var profileAvatar: some View {
        if let avatarData = entry.profileImageData, let avatarImage = UIImage(data: avatarData) {
            Image(uiImage: avatarImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 32, height: 32)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .padding(6)
        } else if UIImage(named: "DefaultProfile") != nil {
            Image("DefaultProfile")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 32, height: 32)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .padding(6)
        } else if let update = entry.friendUpdate, let firstChar = update.friend.username.first {
            Text(String(firstChar).uppercased())
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.purple))
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .padding(6)
        }
    }

    var emptyState: some View {
        VStack(spacing: 4) {
            Text("No updates from\nfriends yet :)")
                .font(.system(size: 11))
                .foregroundColor(Color(white: 0.53))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.96))
    }
}

struct PhotoWidget: Widget {
    // Bumped from "PhotoWidget" so real devices/TestFlight discard stale WidgetKit
    // snapshots/timelines from older Friend Update implementations.
    let kind: String = photoWidgetKind

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
        .configurationDisplayName("Friend Update Widget")
        .description("See the latest post or check-in from your friends.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
