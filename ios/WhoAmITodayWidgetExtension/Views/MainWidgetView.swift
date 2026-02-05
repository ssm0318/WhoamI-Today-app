import SwiftUI
import WidgetKit
import UIKit

// TODO(Gina): This is the main widget view - customize the layout and styling here
struct MainWidgetView: View {
    let data: WidgetData
    let albumImageData: Data?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // DEBUG: Show trackId and albumImageUrl to verify data
            Text("DEBUG: \(data.myCheckIn?.trackId ?? "no track") | img: \(albumImageData != nil ? "LOADED" : "NO")")
                .font(.system(size: 8))
                .foregroundColor(.red)

            // MARK: - Whoami Updates Section
            WhoamiUpdatesSection(
                myCheckIn: data.myCheckIn,
                friends: data.friendsWithUpdates,
                albumImageData: albumImageData
            )

            Divider()
                .padding(.horizontal, 4)

            // MARK: - Shared Playlist Section
            SharedPlaylistSection(playlists: data.sharedPlaylists)

            Divider()
                .padding(.horizontal, 4)

            // MARK: - Question of the Day
            if let question = data.questionOfDay {
                QuestionCard(question: question)
            }
        }
        .padding(16)
        .background(Color.white)
    }
}

// MARK: - Whoami Updates Section
struct WhoamiUpdatesSection: View {
    let myCheckIn: MyCheckIn?
    let friends: [FriendUpdate]
    let albumImageData: Data?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section Header
            HStack(spacing: 6) {
                // TODO(Gina): Replace with your app icon
                Image(systemName: "person.2.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.blue)

                Text("Whoami updates")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.primary)
            }
            .frame(height: 16)

            // Action Buttons + Friends Row
            HStack(spacing: 8) {
                // My Check-In Buttons (I feel, My Battery, My Music)
                CheckInButton(
                    emoji: myCheckIn?.feelingDisplay ?? "🤔",
                    title: "I feel",
                    deepLink: "whoami://app/i-feel"
                )

                CheckInButton(
                    emoji: myCheckIn?.batteryDisplay ?? "🪫",
                    title: "My Battery",
                    deepLink: "whoami://app/my-battery"
                )

                MusicCheckInButton(
                    albumImageData: albumImageData,
                    title: "My Music",
                    deepLink: "whoami://app/my-music"
                )

                // Friend avatars with update indicators
                if friends.isEmpty {
                    // Empty placeholder for friends
                    Spacer()
                } else {
                    ForEach(friends.prefix(2)) { friend in
                        FriendAvatarView(friend: friend)
                    }
                }
            }
            .frame(minHeight: 70) // Maintain consistent height
        }
    }
}

// MARK: - Check-In Button View (I feel, My Battery, My Music)
struct CheckInButton: View {
    let emoji: String
    let title: String
    let deepLink: String

    var body: some View {
        Link(destination: URL(string: deepLink)!) {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        // TODO(Gina): Change button background color
                        .fill(Color.purple.opacity(0.15))
                        .frame(width: 50, height: 50)

                    Text(emoji)
                        .font(.system(size: 24))
                }

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Music Check-In Button (shows album cover if available)
struct MusicCheckInButton: View {
    let albumImageData: Data?
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
                        // Show album cover image from pre-fetched data
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 50, height: 50)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        // No album image - show emoji
                        Text("🎵")
                            .font(.system(size: 24))
                    }
                }

                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Friend Avatar View
struct FriendAvatarView: View {
    let friend: FriendUpdate

    var body: some View {
        Link(destination: URL(string: "whoami://app/friends/\(friend.id)")!) {
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    // Avatar Circle
                    if let imageUrl = friend.profileImage, !imageUrl.isEmpty {
                        // TODO(Gina): Load actual image using AsyncImage (iOS 15+)
                        // For now, show placeholder with hex color background
                        Circle()
                            .fill(Color(hex: friend.profilePic) ?? Color.gray.opacity(0.3))
                            .frame(width: 50, height: 50)
                            .overlay(
                                Text(String(friend.username.prefix(1)).uppercased())
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(.white)
                            )
                    } else {
                        // No profile image - use hex color background
                        Circle()
                            .fill(Color(hex: friend.profilePic) ?? Color.gray.opacity(0.3))
                            .frame(width: 50, height: 50)
                            .overlay(
                                Text(String(friend.username.prefix(1)).uppercased())
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(.white)
                            )
                    }

                    // Update indicator (blue dot) - always show for friends with updates
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 12, height: 12)
                        .offset(x: 2, y: -2)
                }

                Text(friend.username)
                    .font(.system(size: 10))
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Shared Playlist Section
struct SharedPlaylistSection: View {
    let playlists: [PlaylistSong]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section Header
            HStack(spacing: 6) {
                // TODO(Gina): Replace with Spotify icon
                Text("🎧")
                    .font(.system(size: 14))

                Text("Shared Playlist")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
            }

            // Playlist covers row - shows user avatars who shared songs
            HStack(spacing: 8) {
                if playlists.isEmpty {
                    // Empty placeholder to maintain height
                    Text("No playlists yet")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                        .frame(height: 50)
                } else {
                    ForEach(playlists.prefix(5)) { song in
                        PlaylistUserView(song: song)
                    }
                }
            }
            .frame(minHeight: 50)
        }
    }
}

// MARK: - Playlist User View (shows who shared the song)
struct PlaylistUserView: View {
    let song: PlaylistSong

    var body: some View {
        Link(destination: URL(string: "whoami://app/playlists/\(song.id)")!) {
            // Show user avatar with their profile color
            Circle()
                .fill(Color(hex: song.user.profilePic) ?? Color.purple.opacity(0.6))
                .frame(width: 50, height: 50)
                .overlay(
                    // Show user initial or music note
                    Text(String(song.user.username.prefix(1)).uppercased())
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.white)
                )
        }
    }
}

// MARK: - Question Card
struct QuestionCard: View {
    let question: QuestionOfDay

    var body: some View {
        Link(destination: URL(string: question.deepLink)!) {
            HStack(spacing: 12) {
                // Question icon
                Text("❓")
                    .font(.system(size: 24))

                // Question text
                Text(question.question)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Spacer()

                // Arrow
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.purple)
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
