import Foundation

// MARK: - Widget Display Data
struct WidgetData: Codable {
    let myCheckIn: MyCheckIn?
    let friendsWithUpdates: [FriendUpdate]
    let sharedPlaylists: [PlaylistSong]
    let questionOfDay: QuestionOfDay?
    let lastUpdated: Date

    static var placeholder: WidgetData {
        WidgetData(
            myCheckIn: MyCheckIn(
                id: 1,
                isActive: true,
                createdAt: "",
                mood: "🤔",
                socialBattery: nil,  // No battery check-in → widget shows + for My Battery
                description: "",
                trackId: "",
                albumImageUrl: nil
            ),
            friendsWithUpdates: [
                FriendUpdate(id: 1, username: "Matter123", profilePic: "#AABBCC", profileImage: nil),
                FriendUpdate(id: 2, username: "Kipler2323", profilePic: "#FFAABB", profileImage: nil)
            ],
            sharedPlaylists: [
                PlaylistSong(id: 1, user: PlaylistUser(id: 1, username: "User1", profilePic: "#AABBCC", profileImage: nil), trackId: "track1", createdAt: ""),
                PlaylistSong(id: 2, user: PlaylistUser(id: 2, username: "User2", profilePic: "#BBCCDD", profileImage: nil), trackId: "track2", createdAt: ""),
                PlaylistSong(id: 3, user: PlaylistUser(id: 3, username: "User3", profilePic: "#CCDDEE", profileImage: nil), trackId: "track3", createdAt: ""),
                PlaylistSong(id: 4, user: PlaylistUser(id: 4, username: "User4", profilePic: "#DDEEFF", profileImage: nil), trackId: "track4", createdAt: ""),
                PlaylistSong(id: 5, user: PlaylistUser(id: 5, username: "User5", profilePic: "#EEFFAA", profileImage: nil), trackId: "track5", createdAt: "")
            ],
            questionOfDay: QuestionOfDay(
                id: "1",
                question: "What was a funny thing that happened today?",
                content: "What was a funny thing that happened today?",
                createdAt: nil
            ),
            lastUpdated: Date()
        )
    }

    static var empty: WidgetData {
        WidgetData(
            myCheckIn: nil,
            friendsWithUpdates: [],
            sharedPlaylists: [],
            questionOfDay: nil,
            lastUpdated: Date()
        )
    }
}

// MARK: - My Check-In (from /api/user/me/profile -> check_in field)
struct MyCheckIn: Codable {
    let id: Int
    let isActive: Bool
    let createdAt: String
    let mood: String              // "I feel" emoji/text
    let socialBattery: String?    // "My Battery" - "fully_charged", "half", "low", etc.
    let description: String
    let trackId: String           // "My Music" - Spotify track ID
    let albumImageUrl: String?    // Album cover image URL from Spotify

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

    // Helper to get display emoji for "I feel"
    var feelingDisplay: String {
        mood.isEmpty ? "🤔" : mood
    }

    // Helper to get battery emoji based on level
    var batteryDisplay: String {
        guard let battery = socialBattery else { return "🪫" }
        switch battery {
        case "fully_charged": return "🔋"
        case "half", "medium": return "🔋"
        case "low": return "🪫"
        case "empty": return "🪫"
        default: return "🔋"
        }
    }

    // Helper for music display
    var musicDisplay: String {
        trackId.isEmpty ? "🎵" : "🎵"
    }
}

// MARK: - API Response: Friend with Updates (from /api/user/friends/updates/)
struct FriendUpdate: Codable, Identifiable {
    let id: Int
    let username: String
    let profilePic: String      // Hex color code (e.g. "#AABBCC")
    let profileImage: String?   // URL to image or null

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case profilePic = "profile_pic"
        case profileImage = "profile_image"
    }
}

// MARK: - API Response: Playlist Song (from /api/playlist/feed)
struct PlaylistSong: Codable, Identifiable {
    let id: Int
    let user: PlaylistUser
    let trackId: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case user
        case trackId = "track_id"
        case createdAt = "created_at"
    }
}

struct PlaylistUser: Codable {
    let id: Int
    let username: String
    let profilePic: String
    let profileImage: String?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case profilePic = "profile_pic"
        case profileImage = "profile_image"
    }
}

// MARK: - API Response: My Profile (from /api/user/me/)
struct MyProfileResponse: Codable {
    let id: Int
    let username: String
    let checkIn: MyCheckIn?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case checkIn = "check_in"
    }
}

// MARK: - Question of the Day
struct QuestionOfDay: Codable {
    let id: String
    let question: String
    let content: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case question
        case content
        case createdAt = "created_at"
    }

    var deepLink: String {
        "whoami://app/questions/\(id)/new"
    }
}

// MARK: - Paginated Response wrapper
struct PaginatedResponse<T: Codable>: Codable {
    let count: Int
    let next: String?
    let previous: String?
    let results: [T]
}

// MARK: - General Questions Response
struct QuestionGroup: Codable {
    let date: String
    let questions: [GeneralQuestion]
}

struct GeneralQuestion: Codable {
    let type: String
    let id: Int
    let content: String
    let createdAt: String
    let isAdminQuestion: Bool
    let selectedDates: [String]
    let selected: Bool

    enum CodingKeys: String, CodingKey {
        case type
        case id
        case content
        case createdAt = "created_at"
        case isAdminQuestion = "is_admin_question"
        case selectedDates = "selected_dates"
        case selected
    }

    // Convert GeneralQuestion to QuestionOfDay
    func toQuestionOfDay() -> QuestionOfDay {
        return QuestionOfDay(
            id: String(id),
            question: content,
            content: content,
            createdAt: createdAt
        )
    }
}
