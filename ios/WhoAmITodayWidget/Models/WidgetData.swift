import Foundation

struct WidgetData: Codable {
    let friendsWithUpdates: [FriendUpdate]
    let sharedPlaylists: [SharedPlaylist]
    let questionOfDay: QuestionOfDay?
    let lastUpdated: Date

    static var placeholder: WidgetData {
        WidgetData(
            friendsWithUpdates: [
                FriendUpdate(id: "1", name: "Friend 1", avatarUrl: nil, updateCount: 2),
                FriendUpdate(id: "2", name: "Friend 2", avatarUrl: nil, updateCount: 1)
            ],
            sharedPlaylists: [
                SharedPlaylist(id: "1", name: "Summer Vibes", songCount: 12),
                SharedPlaylist(id: "2", name: "Chill Mix", songCount: 8)
            ],
            questionOfDay: QuestionOfDay(
                id: "1",
                question: "What made you smile today?",
                category: "Daily"
            ),
            lastUpdated: Date()
        )
    }

    static var empty: WidgetData {
        WidgetData(
            friendsWithUpdates: [],
            sharedPlaylists: [],
            questionOfDay: nil,
            lastUpdated: Date()
        )
    }
}

struct FriendUpdate: Codable, Identifiable {
    let id: String
    let name: String
    let avatarUrl: String?
    let updateCount: Int
}

struct SharedPlaylist: Codable, Identifiable {
    let id: String
    let name: String
    let songCount: Int
}

struct QuestionOfDay: Codable {
    let id: String
    let question: String
    let category: String
}
