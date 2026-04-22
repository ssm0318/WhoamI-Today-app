import Foundation

class SharedDataManager {
    static let shared = SharedDataManager()
    private let suiteName = "group.com.whoami.today.app"

    private var appGroupContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName)
    }

    private func utf8StringFromAppGroupFile(_ filename: String) -> String? {
        guard let url = appGroupContainerURL?.appendingPathComponent(filename),
              let data = try? Data(contentsOf: url),
              let s = String(data: data, encoding: .utf8),
              !s.isEmpty
        else { return nil }
        return s
    }

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
        if let obj = sharedDefaults?.object(forKey: key) {
            if let s = obj as? String, !s.isEmpty { return s }
            if let data = obj as? Data, let s = String(data: data, encoding: .utf8), !s.isEmpty { return s }
        }
        return stringFromPlistValue(plistDict?[key])
    }

    /// Plist may store strings as `String`, `NSString`, or occasionally `Data` (UTF-8).
    private func stringFromPlistValue(_ any: Any?) -> String? {
        guard let any = any else { return nil }
        if let s = any as? String, !s.isEmpty { return s }
        if let data = any as? Data, let s = String(data: data, encoding: .utf8), !s.isEmpty { return s }
        return nil
    }

    /// JSON blobs may appear as `Data`, or as UTF-8 `String` in UserDefaults / plist (CFPreferences quirk across processes).
    private func data(forKey key: String) -> Data? {
        if let val = sharedDefaults?.data(forKey: key), !val.isEmpty { return val }
        if let obj = sharedDefaults?.object(forKey: key) {
            if let s = obj as? String, let d = s.data(using: .utf8), !d.isEmpty { return d }
        }
        if let pd = plistDict?[key] {
            if let d = pd as? Data, !d.isEmpty { return d }
            if let s = pd as? String, let d = s.data(using: .utf8), !d.isEmpty { return d }
        }
        return nil
    }

    // MARK: - Auth

    var csrfToken: String? {
        string(forKey: "csrftoken") ?? utf8StringFromAppGroupFile("widget_auth_csrftoken.txt")
    }

    var accessToken: String? {
        string(forKey: "access_token") ?? utf8StringFromAppGroupFile("widget_auth_access_token.txt")
    }

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

    var isVersionQ: Bool {
        string(forKey: "user_version_type") == "version_q"
    }

    var apiBaseUrl: String? {
        if let s = string(forKey: "api_base_url"), !s.isEmpty { return s }
        return utf8StringFromAppGroupFile("widget_api_base_url.txt")
    }

    // MARK: - Check-in

    private func myCheckInJSONDataCandidatesWithSource() -> [(source: String, data: Data)] {
        var out: [(source: String, data: Data)] = []
        if let url = appGroupContainerURL?.appendingPathComponent("my_check_in.json"),
           let d = try? Data(contentsOf: url), !d.isEmpty {
            out.append((source: "file:my_check_in.json", data: d))
        }
        if let d = data(forKey: "my_check_in"), !d.isEmpty {
            out.append((source: "defaults:my_check_in", data: d))
        }
        return out
    }

    /// Bytes the widget will try to decode (first non-empty candidate).
    private func myCheckInJSONData() -> Data? {
        myCheckInJSONDataCandidatesWithSource().first?.data
    }

    var myCheckInDecodeSource: String {
        for candidate in myCheckInJSONDataCandidatesWithSource() {
            if (try? JSONDecoder().decode(MyCheckIn.self, from: candidate.data)) != nil {
                return candidate.source
            }
        }
        return "(decode_failed)"
    }

    var myCheckIn: MyCheckIn? {
        for candidate in myCheckInJSONDataCandidatesWithSource() {
            if let v = try? JSONDecoder().decode(MyCheckIn.self, from: candidate.data) { return v }
        }
        return nil
    }

    var cachedAlbumImageData: Data? {
        get {
            if let d = data(forKey: "widget_album_image") { return d }
            guard let url = appGroupContainerURL?.appendingPathComponent("widget_album_image.bin") else { return nil }
            return try? Data(contentsOf: url)
        }
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

    // MARK: - Friend update

    var friendUpdate: FriendUpdate? {
        guard let d = data(forKey: "friend_update") else { return nil }
        return try? JSONDecoder().decode(FriendUpdate.self, from: d)
    }

    var cachedFriendUpdateContentImage: Data? {
        get { data(forKey: "widget_friend_update_content_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_friend_update_content_image")
            sharedDefaults?.synchronize()
        }
    }

    var cachedFriendUpdateProfileImage: Data? {
        get { data(forKey: "widget_friend_update_profile_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_friend_update_profile_image")
            sharedDefaults?.synchronize()
        }
    }

    // MARK: - Raw bytes accessors (for diagnostics)

    var rawMyCheckInBytes: Data? { myCheckInJSONData() }
    var rawSharedPlaylistTrackBytes: Data? { data(forKey: "shared_playlist_track") }
    var rawFriendUpdateBytes: Data? { data(forKey: "friend_update") }

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
        let udFriend = ud?.data(forKey: "friend_update") != nil

        let pd = plistDict
        let pdCsrf = pd?["csrftoken"] as? String != nil
        let pdAccess = pd?["access_token"] as? String != nil
        let pdCheckin = pd?["my_check_in"] as? Data != nil
        let pdFriend = pd?["friend_update"] as? Data != nil
        let pdPlaylist = pd?["shared_playlist_track"] as? Data != nil

        // Image data sizes
        let albumImgLen = cachedSharedPlaylistAlbumImage?.count ?? 0
        let avatarImgLen = cachedSharedPlaylistAvatarImage?.count ?? 0
        let checkinAlbumLen = cachedAlbumImageData?.count ?? 0
        let friendUpdateImgLen = cachedFriendUpdateContentImage?.count ?? 0

        let csrfVal = csrfToken
        let accessVal = accessToken
        let fileCsrf = utf8StringFromAppGroupFile("widget_auth_csrftoken.txt") != nil
        let fileAccess = utf8StringFromAppGroupFile("widget_auth_access_token.txt") != nil
        let fileCheckInJson = appGroupContainerURL
            .map { FileManager.default.fileExists(atPath: $0.appendingPathComponent("my_check_in.json").path) } ?? false
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
        file_auth_txt: csrf=\(fileCsrf), access=\(fileAccess), my_check_in.json=\(fileCheckInJson)
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
        friendUpdateImage: \(friendUpdateImgLen)
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

    func writeCheckInRawState(rawBytesPresent: Bool, decodeOk: Bool, decodeSource: String, rawPreview: String) {
        sharedDefaults?.set(rawBytesPresent, forKey: "widget_my_check_in_raw_present")
        sharedDefaults?.set(decodeOk, forKey: "widget_my_check_in_decode_ok")
        sharedDefaults?.set(decodeSource, forKey: "widget_my_check_in_decode_source")
        sharedDefaults?.set(rawPreview, forKey: "widget_my_check_in_raw_preview")
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
