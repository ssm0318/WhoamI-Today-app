import SwiftUI
import WidgetKit
import UIKit
import AppIntents

// Fixed heights so total widget height is constant regardless of content
private let kWhoamiSectionHeight: CGFloat = 100
private let kPlaylistSectionHeight: CGFloat = 82
private let kQuestionSectionHeight: CGFloat = 52

// Fixed colors so widget looks the same for everyone (white background).
// .primary/.secondary depend on system appearance (Light/Dark), which can make text gray on some devices.
private let kWidgetTextPrimary = Color.black
private let kWidgetTextSecondary = Color(white: 0.45)

// TODO(Gina): This is the main widget view - customize the layout and styling here
struct MainWidgetView: View {
    let data: WidgetData
    let albumImageData: Data?
    let playlistAlbumImages: [String: Data]
    let profileImages: [Int: Data]
    var showSignInPrompt: Bool = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 0) {
                // MARK: - Whoami Updates Section
                WhoamiUpdatesSection(
                    myCheckIn: data.myCheckIn,
                    friends: data.friendsWithUpdates,
                    albumImageData: albumImageData,
                    profileImages: profileImages
                )
                .frame(height: kWhoamiSectionHeight)
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 12)
                Divider()
                    .padding(.horizontal, 4)
                Spacer(minLength: 12)

                // MARK: - Shared Playlist Section
                SharedPlaylistSection(playlists: data.sharedPlaylists, playlistAlbumImages: playlistAlbumImages, profileImages: profileImages)
                .frame(height: kPlaylistSectionHeight)
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 12)
                Divider()
                    .padding(.horizontal, 4)
                Spacer(minLength: 12)

                // MARK: - Question of the Day / Please Sign in (extra spacing above)
                let _ = NSLog("[Widget] MainWidgetView: showSignInPrompt=%@, questionOfDay=%@", String(showSignInPrompt), String(data.questionOfDay != nil))
                Group {
                    if showSignInPrompt {
                        SignInPromptButton()
                    } else if let question = data.questionOfDay {
                        QuestionCard(question: question)
                    } else {
                        Color.clear
                    }
                }
                .frame(height: kQuestionSectionHeight)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 10)

                Spacer(minLength: 0)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(0)

            // MARK: - Refresh button (top-right, iOS 17+)
            if #available(iOS 17.0, *) {
                Button(intent: RefreshWidgetIntent()) {
                    Image("arrow-circular-anti-clockwise")
                        .resizable()
                        .frame(width: 20, height: 20)
                        .foregroundColor(kWidgetTextPrimary.opacity(0.7))
                }
                .buttonStyle(.plain)
                .padding(4)
            }
        }
    }
}

// MARK: - Whoami Updates Section
struct WhoamiUpdatesSection: View {
    let myCheckIn: MyCheckIn?
    let friends: [FriendUpdate]
    let albumImageData: Data?
    let profileImages: [Int: Data]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section Header
            HStack(spacing: 6) {
                Image("IconWhoamiUpdates")
                    .resizable()
                    .frame(width: 16, height: 16)

                Text("Whoami updates")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(kWidgetTextPrimary)
            }

            // Action Buttons + Friends Row (when no check-in data for that slot, show +)
            // #region agent log
            let feelEmoji = (myCheckIn != nil && !(myCheckIn!.mood.isEmpty)) ? myCheckIn?.feelingDisplay : nil
            let hasBatteryData = myCheckIn?.socialBattery != nil && !(myCheckIn!.socialBattery!.isEmpty)
            let batteryEmoji = hasBatteryData ? myCheckIn?.batteryDisplay : nil
            let _ = NSLog("[WhoAmI-Debug] CheckIn emoji: feel=%@ battery=%@", feelEmoji ?? "nil", batteryEmoji ?? "nil")
            // #endregion
            HStack(spacing: 12) {
                CheckInButton(
                    emoji: feelEmoji,
                    title: "I feel",
                    deepLink: "whoami://app/check-in/edit"
                )

                CheckInButton(
                    emoji: batteryEmoji,
                    title: "My Battery",
                    deepLink: "whoami://app/check-in/edit"
                )

                MusicCheckInButton(
                    albumImageData: albumImageData,
                    hasCheckInData: myCheckIn != nil,
                    title: "My Music",
                    deepLink: "whoami://app/check-in/edit"
                )

                // Friend avatars with update indicators
                if friends.isEmpty {
                    Spacer()
                } else {
                    ForEach(friends.prefix(2)) { friend in
                        FriendAvatarView(friend: friend, profileImageData: profileImages[friend.id])
                    }
                }
            }
            .frame(minHeight: 70)

            Spacer(minLength: 0)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Check-In Button View (I feel, My Battery, My Music). When emoji is nil (no data), show empty.
struct CheckInButton: View {
    let emoji: String?
    let title: String
    let deepLink: String

    var body: some View {
        Link(destination: URL(string: deepLink)!) {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.purple.opacity(0.15))
                        .frame(width: 50, height: 50)

                    if let emoji = emoji, !emoji.isEmpty {
                        Text(emoji)
                            .font(.system(size: 24))
                    } else {
                        Image("plus")
                            .resizable()
                            .renderingMode(.template)
                            .frame(width: 20, height: 20)
                            .foregroundColor(kWidgetTextSecondary)
                    }
                }

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(kWidgetTextPrimary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Music Check-In Button (shows album cover if available). When no check-in data, show empty.
struct MusicCheckInButton: View {
    let albumImageData: Data?
    let hasCheckInData: Bool
    let title: String
    let deepLink: String

    var body: some View {
        Link(destination: URL(string: deepLink)!) {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.purple.opacity(0.15))
                        .frame(width: 50, height: 50)

                    if let imageData = albumImageData,
                       let uiImage = UIImage(data: imageData) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 50, height: 50)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else if hasCheckInData {
                        Text("🎵")
                            .font(.system(size: 24))
                    } else {
                        Image("plus")
                            .resizable()
                            .renderingMode(.template)
                            .frame(width: 20, height: 20)
                            .foregroundColor(kWidgetTextSecondary)
                    }
                }

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(kWidgetTextPrimary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Friend Avatar View
struct FriendAvatarView: View {
    let friend: FriendUpdate
    let profileImageData: Data?

    var body: some View {
        Link(destination: URL(string: "whoami://app/users/\(friend.username)")!) {
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    // Avatar Circle with actual profile image
                    if let imageData = profileImageData,
                       let uiImage = UIImage(data: imageData) {
                        // Show actual profile image
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 50, height: 50)
                            .clipShape(Circle())
                    } else {
                        // Fallback to default profile image
                        Image("DefaultProfile")
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 50, height: 50)
                            .clipShape(Circle())
                    }

                    // Update indicator (blue dot) - always show for friends with updates
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 12, height: 12)
                        .offset(x: 2, y: -2)
                }

                Text(friend.username)
                    .font(.system(size: 10))
                    .foregroundColor(kWidgetTextPrimary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Shared Playlist Section
struct SharedPlaylistSection: View {
    let playlists: [PlaylistSong]
    let playlistAlbumImages: [String: Data]
    let profileImages: [Int: Data]

    var body: some View {
        // DEBUG: Print profile images available
        let _ = print("[SharedPlaylistSection] Profile images keys: \(Array(profileImages.keys)), Playlist user IDs: \(playlists.prefix(5).map { $0.user.id })")

        return VStack(alignment: .leading, spacing: 8) {
            // Section Header
            HStack(spacing: 6) {
                Image("IconPlaylist")
                    .resizable()
                    .frame(width: 16, height: 16)

                Text("Shared Playlist")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(kWidgetTextPrimary)
            }

            // Playlist covers row - shows album covers with user profile overlay
            HStack(spacing: 8) {
                if playlists.isEmpty {
                    Text("No playlists yet")
                        .font(.system(size: 12))
                        .foregroundColor(kWidgetTextSecondary)
                        .frame(height: 50)
                } else {
                    ForEach(playlists.prefix(5)) { song in
                        PlaylistUserView(song: song, albumImageData: playlistAlbumImages[song.trackId], profileImageData: profileImages[song.user.id])
                    }
                }
            }
            .frame(minHeight: 50)

            Spacer(minLength: 0)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Playlist User View (shows album cover with user profile overlay)
struct PlaylistUserView: View {
    let song: PlaylistSong
    let albumImageData: Data?
    let profileImageData: Data?

    var body: some View {
        // DEBUG: Print profile image status
        let _ = print("[PlaylistUserView] User: \(song.user.username), ID: \(song.user.id), Has profile data: \(profileImageData != nil), profileImage URL: \(song.user.profileImage ?? "nil")")

        return Link(destination: URL(string: "spotify:track:\(song.trackId)")!) {
            ZStack(alignment: .topTrailing) {
                // Album cover image
                if let imageData = albumImageData,
                   let uiImage = UIImage(data: imageData) {
                    // Show pre-fetched album cover image
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 50, height: 50)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    // Fallback to music note when no image
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.purple.opacity(0.2))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Text("🎵")
                                .font(.system(size: 20))
                        )
                }

                // User profile image overlay (top-right corner)
                ZStack {
                    if let imageData = profileImageData,
                       let uiImage = UIImage(data: imageData) {
                        // Show actual profile image
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 20, height: 20)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .strokeBorder(Color.white, lineWidth: 2)
                            )
                    } else {
                        // Fallback to default profile image
                        Image("DefaultProfile")
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 20, height: 20)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .strokeBorder(Color.white, lineWidth: 2)
                            )
                    }
                }
                .offset(x: 4, y: -4)
            }
            .frame(width: 50, height: 50)
        }
    }
}

// MARK: - Please Sign in (shown in question area when not authenticated)
struct SignInPromptButton: View {
    var body: some View {
        Link(destination: URL(string: "whoami://app/login")!) {
            HStack(spacing: 12) {
                Image("IconQuestion")
                    .resizable()
                    .frame(width: 24, height: 24)

                Text("Please Sign in")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: "#8700FF") ?? Color.purple)
            )
        }
    }
}

// MARK: - Question Card
struct QuestionCard: View {
    let question: QuestionOfDay

    var body: some View {
        // #region agent log
        let _ = NSLog("[WhoAmI-Debug] QuestionCard lineLimit=2 contentLen=%d", question.content.count)
        // #endregion
        Link(destination: URL(string: question.deepLink)!) {
            HStack(alignment: .center, spacing: 12) {
                // Question icon
                Image("IconQuestion")
                    .resizable()
                    .frame(width: 24, height: 24)

                // Question content text (max 2 lines) — give priority so it gets width and wraps
                Text(question.content)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .truncationMode(.tail)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)

                Spacer(minLength: 8)

                // Arrow
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: "#8700FF") ?? Color.purple)
            )
        }
    }
}

// MARK: - Color Extension for Hex Colors
extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0

        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return nil
        }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
