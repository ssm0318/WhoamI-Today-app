import SwiftUI

/// Shown when `user_version_type` is `default` (not the full product experience).
struct DefaultVersionView: View {
    var body: some View {
        VStack(spacing: 8) {
            Text("기본 버전")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.primary)
            Text("전체 기능은 앱에서 이용할 수 있어요.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }
}
