import Foundation

class NetworkManager {
    static let shared = NetworkManager()
    // TODO: Update with actual API base URL
    private let baseURL = "https://whoami-admin-group.gina-park.site/api"

    func fetchWidgetData() async throws -> WidgetData {
        guard SharedDataManager.shared.isAuthenticated,
              let csrfToken = SharedDataManager.shared.csrfToken,
              let accessToken = SharedDataManager.shared.accessToken else {
            throw NetworkError.notAuthenticated
        }

        // Fetch all data in parallel
        async let friends = fetchFriendsWithUpdates(csrf: csrfToken, token: accessToken)
        async let playlists = fetchSharedPlaylists(csrf: csrfToken, token: accessToken)
        async let question = fetchQuestionOfDay(csrf: csrfToken, token: accessToken)

        let data = WidgetData(
            friendsWithUpdates: (try? await friends) ?? [],
            sharedPlaylists: (try? await playlists) ?? [],
            questionOfDay: try? await question,
            lastUpdated: Date()
        )

        // Cache the data
        SharedDataManager.shared.cachedWidgetData = data

        return data
    }

    private func fetchFriendsWithUpdates(csrf: String, token: String) async throws -> [FriendUpdate] {
        // TODO: Update with actual API endpoint
        let url = URL(string: "\(baseURL)/widget/friends-updates")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("csrftoken=\(csrf)", forHTTPHeaderField: "Cookie")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.invalidResponse
        }

        return try JSONDecoder().decode([FriendUpdate].self, from: data)
    }

    private func fetchSharedPlaylists(csrf: String, token: String) async throws -> [SharedPlaylist] {
        // TODO: Update with actual API endpoint
        let url = URL(string: "\(baseURL)/widget/shared-playlists")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("csrftoken=\(csrf)", forHTTPHeaderField: "Cookie")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.invalidResponse
        }

        return try JSONDecoder().decode([SharedPlaylist].self, from: data)
    }

    private func fetchQuestionOfDay(csrf: String, token: String) async throws -> QuestionOfDay {
        // TODO: Update with actual API endpoint
        let url = URL(string: "\(baseURL)/widget/question-of-day")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("csrftoken=\(csrf)", forHTTPHeaderField: "Cookie")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.invalidResponse
        }

        return try JSONDecoder().decode(QuestionOfDay.self, from: data)
    }

    enum NetworkError: Error {
        case notAuthenticated
        case invalidResponse
    }
}
