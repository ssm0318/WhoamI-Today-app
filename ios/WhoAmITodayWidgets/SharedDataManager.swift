import Foundation

class SharedDataManager {
    static let shared = SharedDataManager()
    private let suiteName = "group.com.whoami.today.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    var csrfToken: String? {
        sharedDefaults?.string(forKey: "csrftoken")
    }

    var accessToken: String? {
        sharedDefaults?.string(forKey: "access_token")
    }

    var isAuthenticated: Bool {
        let hasCsrf = csrfToken.map { !$0.isEmpty } ?? false
        let hasAccess = accessToken.map { !$0.isEmpty } ?? false
        return hasCsrf && hasAccess
    }

    var userVersionType: String {
        sharedDefaults?.string(forKey: "user_version_type") ?? "default"
    }

    var isDefaultVersion: Bool {
        userVersionType == "default"
    }

    var myCheckIn: MyCheckIn? {
        guard let data = sharedDefaults?.data(forKey: "my_check_in") else {
            return nil
        }
        return try? JSONDecoder().decode(MyCheckIn.self, from: data)
    }

    var cachedAlbumImageData: Data? {
        get { sharedDefaults?.data(forKey: "widget_album_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_album_image")
            sharedDefaults?.synchronize()
        }
    }

    func writeDiagnostics(mood: String, battery: String, feelingDisplay: String, batteryDisplay: String) {
        let formatter = ISO8601DateFormatter()
        sharedDefaults?.set(mood, forKey: "widget_last_seen_mood")
        sharedDefaults?.set(battery, forKey: "widget_last_seen_battery")
        sharedDefaults?.set(feelingDisplay, forKey: "widget_last_feeling_display")
        sharedDefaults?.set(batteryDisplay, forKey: "widget_last_battery_display")
        sharedDefaults?.set(formatter.string(from: Date()), forKey: "widget_last_getTimeline_at")
        sharedDefaults?.synchronize()
    }
}
