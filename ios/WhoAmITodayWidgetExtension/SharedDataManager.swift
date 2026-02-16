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
        let authenticated = hasCsrf && hasAccess
        NSLog("[Widget] SharedDataManager.isAuthenticated: %@ (csrf: %@, accessToken: %@)", String(authenticated), String(hasCsrf), String(hasAccess))
        return authenticated
    }

    // Spotify credentials
    var spotifyClientId: String? {
        sharedDefaults?.string(forKey: "spotify_client_id")
    }

    var spotifyClientSecret: String? {
        sharedDefaults?.string(forKey: "spotify_client_secret")
    }

    var hasSpotifyCredentials: Bool {
        guard let clientId = spotifyClientId, let clientSecret = spotifyClientSecret else {
            return false
        }
        return !clientId.isEmpty && !clientSecret.isEmpty
    }

    // My Check-In data synced from React Native
    var myCheckIn: MyCheckIn? {
        guard let data = sharedDefaults?.data(forKey: "my_check_in") else {
            return nil
        }
        return try? JSONDecoder().decode(MyCheckIn.self, from: data)
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

    /// Write diagnostics so the main app can see when getTimeline last ran and what mood it saw.
    func setWidgetDiagnostics(lastSeenMood: String?, lastGetTimelineDate: Date) {
        let defs = UserDefaults(suiteName: suiteName)
        defs?.set(lastSeenMood ?? "nil", forKey: "widget_last_seen_mood")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        defs?.set(formatter.string(from: lastGetTimelineDate), forKey: "widget_last_getTimeline_at")
        defs?.synchronize()
    }
}
