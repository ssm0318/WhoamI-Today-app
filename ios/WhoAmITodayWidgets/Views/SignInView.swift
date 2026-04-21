import SwiftUI

struct SignInView: View {
    var descriptionText: String = "Sign in to use WhoAmI Today"

    var body: some View {
        ZStack {
            Color.white

            VStack(spacing: 0) {
                Image("WidgetAppLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 48, height: 48)
                    .clipShape(Circle())
                    .padding(.bottom, 12)

                Link(destination: URL(string: "whoami://app/login")!) {
                    Text("Sign In")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 20)
                                .fill(Color(hex: "#6200EA") ?? Color.purple)
                        )
                }

                Text(descriptionText)
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "#888888") ?? Color.gray)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.top, 12)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // WidgetKit may apply redacted placeholder styling to links/text; keep the real Sign-in UI visible.
        .unredacted()
    }
}

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
