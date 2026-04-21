import Foundation

/// Decodes JSON from App Group (`syncMyCheckIn` / `fetchCheckInFromApi`). The API may send
/// `mood` as `[String]` and `thought` instead of `description`; strict `Codable` was failing
/// (`try? decode` → nil) so the widget showed empty state or stale UI.
struct MyCheckIn: Decodable {
    let id: Int?
    let isActive: Bool?
    let createdAt: String?
    let mood: String
    let socialBattery: String?
    let description: String
    let trackId: String
    let albumImageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case isActive = "is_active"
        case createdAt = "created_at"
        case mood
        case socialBattery = "social_battery"
        case description
        case thought
        case trackId = "track_id"
        case albumImageUrl = "album_image_url"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id)
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)

        if let s = try? c.decode(String.self, forKey: .mood) {
            mood = s
        } else if let arr = try? c.decode([String].self, forKey: .mood) {
            mood = arr.first ?? ""
        } else {
            mood = ""
        }

        socialBattery = try c.decodeIfPresent(String.self, forKey: .socialBattery)

        let desc = try c.decodeIfPresent(String.self, forKey: .description)
        let thought = try c.decodeIfPresent(String.self, forKey: .thought)
        description = desc ?? thought ?? ""

        trackId = try c.decodeIfPresent(String.self, forKey: .trackId) ?? ""
        albumImageUrl = try c.decodeIfPresent(String.self, forKey: .albumImageUrl)
    }

    var feelingDisplay: String? {
        guard !mood.isEmpty else { return nil }
        return getMoodEmoji(mood)
    }

    var batteryDisplay: String? {
        guard let battery = socialBattery, !battery.isEmpty else { return nil }
        return getBatteryEmoji(battery)
    }

    private func getMoodEmoji(_ mood: String) -> String {
        switch mood.lowercased() {
        case "happy": return "😊"
        case "sad": return "😢"
        case "angry": return "😠"
        case "anxious": return "😰"
        case "excited": return "🤩"
        case "tired": return "😴"
        case "calm": return "😌"
        case "confused": return "😕"
        default: return mood
        }
    }

    private func getBatteryEmoji(_ battery: String) -> String {
        switch battery.lowercased() {
        // Keep widget battery visuals aligned with frontend SocialBatteryChipAssets.
        case "super_social": return "🤩"
        case "fully_charged": return "🚀"
        case "moderately_social": return "🔋"
        case "needs_recharge": return "🔌"
        case "low": return "🪫"
        case "completely_drained": return "💤"
        default: return battery
        }
    }
}

// A friend's post displayed in the PhotoWidget.
// Synced from the RN app via syncFriendPost — widget reads the cached binary
// images directly from SharedDataManager.
struct FriendPost: Codable {
    let id: Int
    let type: String
    let content: String
    let images: [String]
    let currentUserRead: Bool
    let authorUsername: String

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case content
        case images
        case currentUserRead = "current_user_read"
        case authorUsername = "author_username"
    }
}

// One track from the shared playlist (someone else's song that the user discovers).
// Synced from the RN app via syncSharedPlaylistTrack — widget reads the cached binary
// images directly from SharedDataManager and never makes network calls.
struct SharedPlaylistTrack: Codable {
    let id: Int
    let trackId: String
    let albumImageUrl: String?
    let sharerUsername: String
    let sharerProfileImageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case trackId = "track_id"
        case albumImageUrl = "album_image_url"
        case sharerUsername = "sharer_username"
        case sharerProfileImageUrl = "sharer_profile_image_url"
    }
}
