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
