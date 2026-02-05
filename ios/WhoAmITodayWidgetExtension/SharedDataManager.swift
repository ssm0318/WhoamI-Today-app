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
}
