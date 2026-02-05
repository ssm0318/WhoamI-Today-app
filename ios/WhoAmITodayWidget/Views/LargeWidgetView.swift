import SwiftUI
import WidgetKit

struct LargeWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Action buttons row
            HStack(spacing: 8) {
                ActionButton(
                    icon: "person.2.fill",
                    title: "Friends",
                    count: data.friendsWithUpdates.count,
                    destination: "whoami://app/friends"
                )

                ActionButton(
                    icon: "music.note.list",
                    title: "Playlists",
                    count: data.sharedPlaylists.count,
                    destination: "whoami://app/playlists"
                )

                ActionButton(
                    icon: "questionmark.circle.fill",
                    title: "Question",
                    count: nil,
                    destination: "whoami://app/question"
                )
            }

            Divider()

            // Question of the day section
            if let question = data.questionOfDay {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Today's Question")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Link(destination: URL(string: "whoami://app/question")!) {
                        Text(question.question)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .lineLimit(2)
                            .foregroundColor(.primary)
                    }
                }
            }

            Divider()

            // Friends with updates
            VStack(alignment: .leading, spacing: 6) {
                Text("Friends with Updates")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if data.friendsWithUpdates.isEmpty {
                    Text("No updates from friends")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(data.friendsWithUpdates.prefix(3)) { friend in
                        Link(destination: URL(string: "whoami://app/friends/\(friend.id)")!) {
                            HStack {
                                Circle()
                                    .fill(Color.blue.opacity(0.3))
                                    .frame(width: 24, height: 24)
                                    .overlay(
                                        Text(String(friend.name.prefix(1)))
                                            .font(.caption2)
                                            .fontWeight(.medium)
                                    )

                                Text(friend.name)
                                    .font(.caption)
                                    .foregroundColor(.primary)

                                Spacer()

                                Text("\(friend.updateCount) new")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }

            Spacer()

            // Shared playlists count
            if !data.sharedPlaylists.isEmpty {
                HStack {
                    Image(systemName: "music.note.list")
                        .font(.caption)
                    Text("\(data.sharedPlaylists.count) shared playlists")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
    }
}
