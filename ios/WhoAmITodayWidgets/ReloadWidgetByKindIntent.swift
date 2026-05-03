import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct ReloadWidgetByKindIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh widget"
    static var description = IntentDescription("Reloads the widget's timeline for the given kind.")

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Widget Kind")
    var kind: String

    init() {}

    init(kind: String) {
        self.kind = kind
    }

    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
        return .result()
    }
}
