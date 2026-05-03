import AppIntents
import WidgetKit

/// Refreshes the My Check-in widget without launching the host app (iOS 17+).
@available(iOS 17.0, *)
struct ReloadCheckinWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh check-in"
    static var description = IntentDescription("Reloads the My Check-in widget from saved data.")

    /// Required so tapping the widget button does not foreground the main app.
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadTimelines(ofKind: "CheckinWidgetV3")
        return .result()
    }
}
