import WidgetKit
import SwiftUI
import UIKit

struct PhotoWidgetEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let isDefaultVersion: Bool
    let friendPost: FriendPost?
    let postImageData: Data?
    let authorImageData: Data?
}

struct PhotoWidgetProvider: TimelineProvider {
    private func currentEntry() -> PhotoWidgetEntry {
        let mgr = SharedDataManager.shared
        return PhotoWidgetEntry(
            date: Date(),
            isAuthenticated: mgr.isAuthenticated,
            isDefaultVersion: mgr.isDefaultVersion,
            friendPost: mgr.friendPost,
            postImageData: mgr.cachedFriendPostImage,
            authorImageData: mgr.cachedFriendPostAuthorImage
        )
    }

    func placeholder(in context: Context) -> PhotoWidgetEntry {
        currentEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (PhotoWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoWidgetEntry>) -> Void) {
        let mgr = SharedDataManager.shared
        let isAuth = mgr.isAuthenticated
        let isDefault = mgr.isDefaultVersion
        let friendPost = mgr.friendPost
        let postImageData = mgr.cachedFriendPostImage
        let authorImageData = mgr.cachedFriendPostAuthorImage

        let entry = PhotoWidgetEntry(
            date: Date(),
            isAuthenticated: isAuth,
            isDefaultVersion: isDefault,
            friendPost: friendPost,
            postImageData: postImageData,
            authorImageData: authorImageData
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)

        // Fire-and-forget: self-fetch from API when no cached data
        if isAuth && !isDefault && friendPost == nil {
            Task.detached {
                await Self.fetchFriendPostFromApi()
            }
        }
    }

    /// Fetch friend post from API, save to App Group, then reload timeline.
    /// Matches Android PhotoWidgetProvider.fetchFriendPostFromApi logic.
    private static func fetchFriendPostFromApi() async {
        guard let json = await WidgetAPIHelper.fetchJSON(endpoint: "user/friends/?type=all") else { return }
        guard let results = json["results"] as? [[String: Any]] else { return }

        // Filter friends with unread posts
        let friendsWithPosts = results.filter { friend in
            let unreadCount = friend["unread_post_cnt"] as? Int ?? 0
            let hasPost = friend["latest_unread_post"] != nil && !(friend["latest_unread_post"] is NSNull)
            return unreadCount > 0 && hasPost
        }

        guard !friendsWithPosts.isEmpty else { return }

        // Pick random friend
        let picked = friendsWithPosts[Int.random(in: 0..<friendsWithPosts.count)]
        guard let post = picked["latest_unread_post"] as? [String: Any] else { return }
        let authorUsername = picked["username"] as? String ?? ""
        let profileImageUrl = picked["profile_image"] as? String ?? ""

        // Build friend_post JSON
        var friendPostDict: [String: Any] = [
            "id": post["id"] as? Int ?? 0,
            "type": post["type"] as? String ?? "",
            "content": post["content"] as? String ?? "",
            "images": post["images"] as? [String] ?? [],
            "current_user_read": false,
            "author_username": authorUsername
        ]

        WidgetAPIHelper.storeJSON(friendPostDict, forKey: "friend_post")

        // Download images
        if !profileImageUrl.isEmpty, let url = URL(string: profileImageUrl),
           let data = await WidgetAPIHelper.downloadImageData(from: url) {
            WidgetAPIHelper.storeData(data, forKey: "widget_friend_post_author_image")
        }

        let images = post["images"] as? [String] ?? []
        if let firstImageUrl = images.first, !firstImageUrl.isEmpty,
           let url = URL(string: firstImageUrl),
           let data = await WidgetAPIHelper.downloadImageData(from: url) {
            WidgetAPIHelper.storeData(data, forKey: "widget_friend_post_image")
        }

        WidgetCenter.shared.reloadTimelines(ofKind: "PhotoWidget")
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
        Link(destination: URL(string: "whoami://app/friends/feed")!) {
            ZStack(alignment: .topTrailing) {
                // Post content (image, text, or empty state)
                if let imageData = entry.postImageData, let uiImage = UIImage(data: imageData) {
                    // Image post
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                } else if let post = entry.friendPost {
                    let trimmedContent = post.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmedContent.isEmpty {
                        // Text post
                        VStack {
                            Spacer()
                            Text(trimmedContent)
                                .font(.system(size: 11))
                                .foregroundColor(Color(white: 0.2))
                                .lineLimit(5)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 10)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.white)
                    } else {
                        emptyState
                    }
                } else {
                    emptyState
                }

                // Author avatar overlay (top-trailing)
                authorAvatar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    var authorAvatar: some View {
        if let avatarData = entry.authorImageData, let avatarImage = UIImage(data: avatarData) {
            Image(uiImage: avatarImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 24, height: 24)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .padding(6)
        } else if let post = entry.friendPost, let firstChar = post.authorUsername.first {
            Text(String(firstChar).uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 24, height: 24)
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
        .configurationDisplayName("WhoAmI Friend Post")
        .description("See the latest updates from your friends.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}
