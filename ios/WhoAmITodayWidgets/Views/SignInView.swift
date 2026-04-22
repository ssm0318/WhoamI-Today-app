import SwiftUI
import WidgetKit

struct SignInView: View {
    enum LayoutStyle {
        case vertical
        case horizontal
    }

    var widgetKind: String
    var descriptionText: String = "Sign in to use WhoAmI Today"
    var layoutStyle: LayoutStyle = .vertical

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.white

            VStack(spacing: 0) {
                if layoutStyle == .horizontal {
                    HStack(spacing: 10) {
                        logo
                        signInButton
                    }
                } else {
                    VStack(spacing: 0) {
                        logo
                            .padding(.bottom, 12)
                        signInButton
                    }
                }

                Text(descriptionText)
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "#888888") ?? Color.gray)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.top, 12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            refreshButton
                .padding(.top, 6)
                .padding(.trailing, 6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // WidgetKit may apply redacted placeholder styling to links/text; keep the real Sign-in UI visible.
        .unredacted()
    }

    private var logo: some View {
        Image("WidgetAppLogo")
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: 48, height: 48)
            .clipShape(Circle())
    }

    private var signInButton: some View {
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
    }

    @ViewBuilder
    private var refreshButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: ReloadWidgetByKindIntent(kind: widgetKind)) {
                refreshIcon
            }
            .buttonStyle(.plain)
        } else {
            Link(destination: URL(string: "whoami://widget-refresh")!) {
                refreshIcon
            }
        }
    }

    private var refreshIcon: some View {
        Image(systemName: "arrow.clockwise")
            .font(.system(size: 11, weight: .regular))
            .foregroundColor(Color.gray.opacity(0.7))
            .frame(width: 20, height: 20)
            .background(Circle().fill(Color.gray.opacity(0.08)))
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
