import SwiftUI
import WidgetKit

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        HStack(spacing: 12) {
            // Left side - Action buttons
            VStack(spacing: 8) {
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
            .frame(maxWidth: 100)

            Divider()

            // Right side - Question of the day
            VStack(alignment: .leading, spacing: 8) {
                Text("Today's Question")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let question = data.questionOfDay {
                    Link(destination: URL(string: "whoami://app/question")!) {
                        Text(question.question)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .lineLimit(3)
                            .foregroundColor(.primary)
                    }

                    Spacer()

                    Text(question.category)
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.2))
                        .cornerRadius(4)
                } else {
                    Text("No question today")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
    }
}

struct ActionButton: View {
    let icon: String
    let title: String
    let count: Int?
    let destination: String

    var body: some View {
        Link(destination: URL(string: destination)!) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption2)
                if let count = count, count > 0 {
                    Text("(\(count))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.gray.opacity(0.15))
            .cornerRadius(6)
        }
        .buttonStyle(PlainButtonStyle())
    }
}
