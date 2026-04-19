import Foundation

class SharedDataManager {
    static let shared = SharedDataManager()
    private let suiteName = "group.com.whoami.today.app"

    private var sharedDefaults: UserDefaults? {
        let defaults = UserDefaults(suiteName: suiteName)
        defaults?.synchronize()
        return defaults
    }

    // Direct plist file reading via PropertyListSerialization — bypasses cfprefsd
    // which can be stale in the widget process (especially on the iOS simulator).
    private var plistDict: [String: Any]? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: suiteName
        ) else { return nil }
        let plistURL = containerURL
            .appendingPathComponent("Library/Preferences/\(suiteName).plist")
        guard let rawData = try? Data(contentsOf: plistURL),
              let dict = try? PropertyListSerialization.propertyList(
                  from: rawData, options: [], format: nil
              ) as? [String: Any]
        else { return nil }
        return dict
    }

    // MARK: - Read helpers (UserDefaults first, plist file fallback)

    private func string(forKey key: String) -> String? {
        if let val = sharedDefaults?.string(forKey: key), !val.isEmpty { return val }
        return plistDict?[key] as? String
    }

    private func data(forKey key: String) -> Data? {
        if let val = sharedDefaults?.data(forKey: key) { return val }
        return plistDict?[key] as? Data
    }

    // MARK: - Auth

    var csrfToken: String? { string(forKey: "csrftoken") }
    var accessToken: String? { string(forKey: "access_token") }

    var isAuthenticated: Bool {
        let hasCsrf = csrfToken.map { !$0.isEmpty } ?? false
        let hasAccess = accessToken.map { !$0.isEmpty } ?? false
        return hasCsrf && hasAccess
    }

    // MARK: - Version

    var userVersionType: String {
        string(forKey: "user_version_type") ?? "default"
    }

    var isDefaultVersion: Bool {
        guard let vt = string(forKey: "user_version_type") else {
            return false  // key not synced yet → don't gate content
        }
        return vt == "default"
    }

    var apiBaseUrl: String? {
        sharedDefaults?.string(forKey: "api_base_url")
    }

    // MARK: - Check-in

    var myCheckIn: MyCheckIn? {
        guard let d = data(forKey: "my_check_in") else { return nil }
        return try? JSONDecoder().decode(MyCheckIn.self, from: d)
    }

    var cachedAlbumImageData: Data? {
        get { data(forKey: "widget_album_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_album_image")
            sharedDefaults?.synchronize()
        }
    }

    // MARK: - Shared playlist

    var sharedPlaylistTrack: SharedPlaylistTrack? {
        guard let d = data(forKey: "shared_playlist_track") else { return nil }
        return try? JSONDecoder().decode(SharedPlaylistTrack.self, from: d)
    }

    var cachedSharedPlaylistAlbumImage: Data? {
        get { data(forKey: "widget_shared_playlist_album_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_shared_playlist_album_image")
            sharedDefaults?.synchronize()
        }
    }

    var cachedSharedPlaylistAvatarImage: Data? {
        get { data(forKey: "widget_shared_playlist_avatar_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_shared_playlist_avatar_image")
            sharedDefaults?.synchronize()
        }
    }

    // MARK: - Friend post

    var friendPost: FriendPost? {
        guard let d = data(forKey: "friend_post") else { return nil }
        return try? JSONDecoder().decode(FriendPost.self, from: d)
    }

    var cachedFriendPostImage: Data? {
        get { data(forKey: "widget_friend_post_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_friend_post_image")
            sharedDefaults?.synchronize()
        }
    }

    var cachedFriendPostAuthorImage: Data? {
        get { data(forKey: "widget_friend_post_author_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_friend_post_author_image")
            sharedDefaults?.synchronize()
        }
    }

    // MARK: - Raw bytes accessors (for diagnostics)

    var rawMyCheckInBytes: Data? { data(forKey: "my_check_in") }
    var rawSharedPlaylistTrackBytes: Data? { data(forKey: "shared_playlist_track") }

    var appGroupReachable: Bool {
        sharedDefaults != nil
    }

    // MARK: - Widget process diagnostics

    /// Writes a heartbeat file so the host process can verify what the widget sees.
    func writeWidgetHeartbeat(source: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: suiteName
        ) else { return }

        let plistURL = containerURL
            .appendingPathComponent("Library/Preferences/\(suiteName).plist")
        let plistExists = FileManager.default.fileExists(atPath: plistURL.path)
        let plistSize = (try? FileManager.default.attributesOfItem(atPath: plistURL.path)[.size] as? Int) ?? 0

        let ud = sharedDefaults
        let udCsrf = ud?.string(forKey: "csrftoken") != nil
        let udAccess = ud?.string(forKey: "access_token") != nil
        let udCheckin = ud?.data(forKey: "my_check_in") != nil
        let udPlaylist = ud?.data(forKey: "shared_playlist_track") != nil
        let udFriend = ud?.data(forKey: "friend_post") != nil

        let pd = plistDict
        let pdCsrf = pd?["csrftoken"] as? String != nil
        let pdAccess = pd?["access_token"] as? String != nil
        let pdCheckin = pd?["my_check_in"] as? Data != nil
        let pdFriend = pd?["friend_post"] as? Data != nil
        let pdPlaylist = pd?["shared_playlist_track"] as? Data != nil

        // Image data sizes
        let albumImgLen = cachedSharedPlaylistAlbumImage?.count ?? 0
        let avatarImgLen = cachedSharedPlaylistAvatarImage?.count ?? 0
        let checkinAlbumLen = cachedAlbumImageData?.count ?? 0
        let friendPostImgLen = cachedFriendPostImage?.count ?? 0

        let csrfVal = string(forKey: "csrftoken")
        let accessVal = string(forKey: "access_token")
        let authResult = isAuthenticated
        let defaultResult = isDefaultVersion
        let versionVal = string(forKey: "user_version_type")

        let lines = """
        widget_heartbeat (\(source))
        time: \(ISO8601DateFormatter().string(from: Date()))
        container: \(containerURL.path)
        plist_exists: \(plistExists), size: \(plistSize)
        --- Computed values ---
        isAuthenticated: \(authResult)
        isDefaultVersion: \(defaultResult)
        csrfToken: \(csrfVal != nil ? "'\(csrfVal!.prefix(8))...'" : "nil")
        accessToken: \(accessVal != nil ? "'\(accessVal!.prefix(8))...'" : "nil")
        versionType: \(versionVal ?? "nil")
        --- UserDefaults ---
        csrf: \(udCsrf), access: \(udAccess)
        checkin: \(udCheckin), playlist: \(udPlaylist), friend: \(udFriend)
        --- Plist File ---
        dict_nil: \(pd == nil)
        csrf: \(pdCsrf), access: \(pdAccess)
        checkin: \(pdCheckin), playlist: \(pdPlaylist), friend: \(pdFriend)
        --- Image sizes (bytes) ---
        sharedPlaylistAlbum: \(albumImgLen)
        sharedPlaylistAvatar: \(avatarImgLen)
        checkinAlbum: \(checkinAlbumLen)
        friendPostImage: \(friendPostImgLen)
        """

        let heartbeatURL = containerURL.appendingPathComponent("widget_heartbeat.txt")
        try? lines.write(to: heartbeatURL, atomically: true, encoding: .utf8)
    }

    // MARK: - Diagnostic writes (widget → plist, always via UserDefaults)

    func writeDiagnostics(mood: String, battery: String, feelingDisplay: String, batteryDisplay: String) {
        let formatter = ISO8601DateFormatter()
        sharedDefaults?.set(mood, forKey: "widget_last_seen_mood")
        sharedDefaults?.set(battery, forKey: "widget_last_seen_battery")
        sharedDefaults?.set(feelingDisplay, forKey: "widget_last_feeling_display")
        sharedDefaults?.set(batteryDisplay, forKey: "widget_last_battery_display")
        sharedDefaults?.set(formatter.string(from: Date()), forKey: "widget_last_getTimeline_at")
        sharedDefaults?.synchronize()
    }

    func writeCheckInRawState(rawBytesPresent: Bool, decodeOk: Bool) {
        sharedDefaults?.set(rawBytesPresent, forKey: "widget_my_check_in_raw_present")
        sharedDefaults?.set(decodeOk, forKey: "widget_my_check_in_decode_ok")
        sharedDefaults?.synchronize()
    }

    func writeAlbumDiagnostics(
        trackId: String,
        sharerUsername: String,
        albumImageLen: Int,
        avatarImageLen: Int,
        decodeError: String?
    ) {
        let formatter = ISO8601DateFormatter()
        sharedDefaults?.set(formatter.string(from: Date()), forKey: "album_widget_last_getTimeline_at")
        sharedDefaults?.set(trackId, forKey: "album_widget_last_saw_track_id")
        sharedDefaults?.set(sharerUsername, forKey: "album_widget_last_sharer_username")
        sharedDefaults?.set(albumImageLen, forKey: "album_widget_last_album_image_len")
        sharedDefaults?.set(avatarImageLen, forKey: "album_widget_last_avatar_image_len")
        sharedDefaults?.set(decodeError ?? "", forKey: "album_widget_last_decode_error")
        sharedDefaults?.synchronize()
    }
}
