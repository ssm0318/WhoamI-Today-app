import SwiftUI
import WidgetKit

struct SmallWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Question of the day (shortened)
            if let question = data.questionOfDay {
                Link(destination: URL(string: "whoami://app/question")!) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Today's Question")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(question.question)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(2)
                            .foregroundColor(.primary)
                    }
                }
            }

            Spacer()

            // Quick action button
            Link(destination: URL(string: "whoami://app/friends")!) {
                HStack {
                    Image(systemName: "person.2.fill")
                        .font(.caption)
                    Text("\(data.friendsWithUpdates.count) updates")
                        .font(.caption2)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.2))
                .cornerRadius(8)
            }
        }
        .padding()
    }
}
