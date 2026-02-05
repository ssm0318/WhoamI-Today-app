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
        guard let csrf = csrfToken, let access = accessToken else {
            return false
        }
        return !csrf.isEmpty && !access.isEmpty
    }

    var cachedWidgetData: WidgetData? {
        get {
            guard let data = sharedDefaults?.data(forKey: "widget_data") else {
                return nil
            }
            return try? JSONDecoder().decode(WidgetData.self, from: data)
        }
        set {
            if let newValue = newValue,
               let data = try? JSONEncoder().encode(newValue) {
                sharedDefaults?.set(data, forKey: "widget_data")
            } else {
                sharedDefaults?.removeObject(forKey: "widget_data")
            }
        }
    }
}
