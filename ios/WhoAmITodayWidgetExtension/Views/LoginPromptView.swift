import SwiftUI
import WidgetKit

struct LoginPromptView: View {
    var body: some View {
        Link(destination: URL(string: "whoami://app/login")!) {
            Text("Please Sign in")
                .font(.headline)
                .foregroundColor(.accentColor)
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
