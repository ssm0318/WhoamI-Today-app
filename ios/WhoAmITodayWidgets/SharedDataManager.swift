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

    // Shared playlist track (someone else's song the user discovers).
    // Kept separate from `myCheckIn` so AlbumCoverWidget and CheckinWidget never share state.
    var sharedPlaylistTrack: SharedPlaylistTrack? {
        guard let data = sharedDefaults?.data(forKey: "shared_playlist_track") else {
            return nil
        }
        return try? JSONDecoder().decode(SharedPlaylistTrack.self, from: data)
    }

    var cachedSharedPlaylistAlbumImage: Data? {
        get { sharedDefaults?.data(forKey: "widget_shared_playlist_album_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_shared_playlist_album_image")
            sharedDefaults?.synchronize()
        }
    }

    var cachedSharedPlaylistAvatarImage: Data? {
        get { sharedDefaults?.data(forKey: "widget_shared_playlist_avatar_image") }
        set {
            sharedDefaults?.set(newValue, forKey: "widget_shared_playlist_avatar_image")
            sharedDefaults?.synchronize()
        }
    }

    // Raw bytes accessors — distinguish "key absent" from "decode failed"
    var rawMyCheckInBytes: Data? {
        sharedDefaults?.data(forKey: "my_check_in")
    }

    var rawSharedPlaylistTrackBytes: Data? {
        sharedDefaults?.data(forKey: "shared_playlist_track")
    }

    var appGroupReachable: Bool {
        sharedDefaults != nil
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

    // Writes after CheckinWidget runs getTimeline — separates raw presence from decode success
    func writeCheckInRawState(rawBytesPresent: Bool, decodeOk: Bool) {
        sharedDefaults?.set(rawBytesPresent, forKey: "widget_my_check_in_raw_present")
        sharedDefaults?.set(decodeOk, forKey: "widget_my_check_in_decode_ok")
        sharedDefaults?.synchronize()
    }

    // Writes after AlbumCoverWidget runs getTimeline
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
