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
            mood = arr.randomElement() ?? ""
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
        return mood
    }

    var batteryDisplay: String? {
        guard let battery = socialBattery, !battery.isEmpty else { return nil }
        return getBatteryEmoji(battery)
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

// Friend update (post OR check-in) displayed in the Friend Update Widget.
// Synced from the RN app via syncFriendUpdate — widget reads the cached binary
// profile/content images directly from SharedDataManager.
struct FriendUpdate: Decodable {
    enum Kind: String, Decodable {
        case post
        case checkin
    }

    enum CheckinVariation: String, Decodable {
        case album
        case mood
        case socialBattery = "social_battery"
        case thought
    }

    struct Friend: Decodable {
        let username: String
    }

    struct Post: Decodable {
        let id: Int
        let content: String
        let hasImage: Bool

        enum CodingKeys: String, CodingKey {
            case id
            case content
            case hasImage = "has_image"
        }
    }

    struct Checkin: Decodable {
        let variation: CheckinVariation
        let mood: String?
        let socialBattery: String?
        let description: String?
        let trackId: String?

        enum CodingKeys: String, CodingKey {
            case variation
            case mood
            case socialBattery = "social_battery"
            case description
            case trackId = "track_id"
        }
    }

    let kind: Kind
    let friend: Friend
    let post: Post?
    let checkin: Checkin?
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
