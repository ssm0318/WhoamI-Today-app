import Foundation

struct MyCheckIn: Codable {
    let id: Int
    let isActive: Bool
    let createdAt: String
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
        case trackId = "track_id"
        case albumImageUrl = "album_image_url"
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
        case "super_social", "fully_charged", "moderately_social": return "🔋"
        case "needs_recharge", "low", "completely_drained": return "🪫"
        default: return battery
        }
    }
}
