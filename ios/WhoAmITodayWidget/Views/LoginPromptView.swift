import SwiftUI
import WidgetKit

struct LoginPromptView: View {
    var body: some View {
        Link(destination: URL(string: "whoami://app/login")!) {
            VStack(spacing: 12) {
                Image(systemName: "person.crop.circle.badge.exclamationmark")
                    .font(.largeTitle)
                    .foregroundColor(.blue)

                Text("Login Required")
                    .font(.headline)
                    .foregroundColor(.primary)

                Text("Tap to open WhoAmI Today")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct PlaceholderView: View {
    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Loading...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
