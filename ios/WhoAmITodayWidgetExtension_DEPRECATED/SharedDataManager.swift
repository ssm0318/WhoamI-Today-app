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

    // Cached images for refresh follow-up (so we don't refetch in second getTimeline)
    private let widgetAlbumKey = "widget_album_image"
    private let widgetPlaylistPrefix = "widget_pl_"
    private let widgetProfilePrefix = "widget_pf_"
    private let widgetPlaylistKeysKey = "widget_pl_keys"
    private let widgetProfileKeysKey = "widget_pf_keys"

    var cachedAlbumImageData: Data? {
        get { sharedDefaults?.data(forKey: widgetAlbumKey) }
        set {
            sharedDefaults?.set(newValue, forKey: widgetAlbumKey)
            sharedDefaults?.synchronize()
        }
    }

    var cachedPlaylistAlbumImages: [String: Data] {
        get {
            guard let keys = sharedDefaults?.stringArray(forKey: widgetPlaylistKeysKey) else { return [:] }
            var out: [String: Data] = [:]
            for k in keys {
                if let d = sharedDefaults?.data(forKey: widgetPlaylistPrefix + k) { out[k] = d }
            }
            return out
        }
        set {
            sharedDefaults?.set(Array(newValue.keys), forKey: widgetPlaylistKeysKey)
            for (k, v) in newValue { sharedDefaults?.set(v, forKey: widgetPlaylistPrefix + k) }
            sharedDefaults?.synchronize()
        }
    }

    var cachedProfileImages: [Int: Data] {
        get {
            guard let keys = sharedDefaults?.stringArray(forKey: widgetProfileKeysKey) else { return [:] }
            var out: [Int: Data] = [:]
            for s in keys { if let id = Int(s), let d = sharedDefaults?.data(forKey: widgetProfilePrefix + s) { out[id] = d } }
            return out
        }
        set {
            sharedDefaults?.set(newValue.keys.map { String($0) }, forKey: widgetProfileKeysKey)
            for (k, v) in newValue { sharedDefaults?.set(v, forKey: widgetProfilePrefix + String(k)) }
            sharedDefaults?.synchronize()
        }
    }

    /// Call after writing all widget caches so the follow-up getTimeline sees them.
    func synchronizeWidgetCaches() {
        sharedDefaults?.synchronize()
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
