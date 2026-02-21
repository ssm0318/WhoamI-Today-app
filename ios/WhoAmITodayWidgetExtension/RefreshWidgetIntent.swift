import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct RefreshWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh widget"
    static var description = IntentDescription("Reloads the widget to show the latest check-in and data.")

    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadTimelines(ofKind: "WhoAmITodayWidget")
        return .result()
    }
}

/// Empty intent used as a full-widget background button so taps on empty area don't open the app (iOS widget tap-through bug workaround).
@available(iOS 17.0, *)
struct WidgetBackgroundIntent: AppIntent {
    static var title: LocalizedStringResource = "Widget background"
    static var description = IntentDescription("Prevents widget tap from opening the app.")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
