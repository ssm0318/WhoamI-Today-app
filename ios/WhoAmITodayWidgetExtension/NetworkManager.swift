import Foundation

class NetworkManager {
    static let shared = NetworkManager()
    // TODO(Gina): Update with actual API base URL
    private let baseURL = "https://whoami-admin-group.gina-park.site"

    // DEBUG: Store last API status for display
    static var lastProfileStatus: Int = 0
    static var lastFriendsStatus: Int = 0
    static var lastPlaylistStatus: Int = 0
    static var lastError: String = ""

    func fetchWidgetData() async throws -> WidgetData {
        print("[Widget] fetchWidgetData called")
        print("[Widget] isAuthenticated: \(SharedDataManager.shared.isAuthenticated)")
        print("[Widget] csrfToken exists: \(SharedDataManager.shared.csrfToken != nil)")
        print("[Widget] accessToken exists: \(SharedDataManager.shared.accessToken != nil)")

        guard SharedDataManager.shared.isAuthenticated,
              let csrfToken = SharedDataManager.shared.csrfToken,
              let accessToken = SharedDataManager.shared.accessToken else {
            print("[Widget] Not authenticated - throwing error")
            throw NetworkError.notAuthenticated
        }

        print("[Widget] Starting API calls...")

        // Fetch all data in parallel
        async let myProfile = fetchMyProfile(csrf: csrfToken, token: accessToken)
        async let friends = fetchFriendsWithUpdates(csrf: csrfToken, token: accessToken)
        async let playlists = fetchPlaylistFeed(csrf: csrfToken, token: accessToken)

        let profileResult = try? await myProfile
        let friendsResult = (try? await friends) ?? []
        let playlistsResult = (try? await playlists) ?? []

        print("[Widget] Profile result: \(profileResult != nil ? "success" : "nil")")
        print("[Widget] Friends count: \(friendsResult.count)")
        print("[Widget] Playlists count: \(playlistsResult.count)")

        // Use myCheckIn from SharedDataManager (synced from RN with album image) if available,
        // otherwise fall back to API data
        var myCheckInData = SharedDataManager.shared.myCheckIn ?? profileResult?.checkIn
        print("[Widget] Using myCheckIn from: \(SharedDataManager.shared.myCheckIn != nil ? "SharedDataManager" : "API")")

        // Fetch album image from Spotify if we have a trackId but no albumImageUrl
        if var checkIn = myCheckInData,
           !checkIn.trackId.isEmpty,
           (checkIn.albumImageUrl == nil || checkIn.albumImageUrl?.isEmpty == true),
           SpotifyManager.shared.isConfigured {
            print("[Widget] Fetching album image from Spotify for trackId: \(checkIn.trackId)")
            if let track = try? await SpotifyManager.shared.getTrack(trackId: checkIn.trackId) {
                checkIn = MyCheckIn(
                    id: checkIn.id,
                    isActive: checkIn.isActive,
                    createdAt: checkIn.createdAt,
                    mood: checkIn.mood,
                    socialBattery: checkIn.socialBattery,
                    description: checkIn.description,
                    trackId: checkIn.trackId,
                    albumImageUrl: track.albumImageUrl
                )
                myCheckInData = checkIn
                print("[Widget] Album image fetched: \(track.albumImageUrl ?? "nil")")
            }
        }

        let data = WidgetData(
            myCheckIn: myCheckInData,
            friendsWithUpdates: friendsResult,
            sharedPlaylists: playlistsResult,
            // TODO(Gina): Add question of day API if available
            questionOfDay: QuestionOfDay(
                id: "1",
                question: "What was a funny thing that happened today?",
                deepLink: "whoami://app/question"
            ),
            lastUpdated: Date()
        )

        // Cache the data
        SharedDataManager.shared.cachedWidgetData = data

        print("[Widget] Data cached successfully")

        return data
    }

    // MARK: - Fetch My Profile (/api/user/me/profile)
    private func fetchMyProfile(csrf: String, token: String) async throws -> MyProfileResponse {
        let url = URL(string: "\(baseURL)/api/user/me/profile")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        // Cookie header should contain both csrftoken and access_token
        request.setValue("csrftoken=\(csrf); access_token=\(token)", forHTTPHeaderField: "Cookie")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            NetworkManager.lastError = "Net: \(error.localizedDescription.prefix(30))"
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            print("[Widget] fetchMyProfile: Invalid response type")
            throw NetworkError.invalidResponse
        }

        NetworkManager.lastProfileStatus = httpResponse.statusCode
        print("[Widget] fetchMyProfile status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            NetworkManager.lastError = "Profile: \(httpResponse.statusCode)"
            print("[Widget] fetchMyProfile failed: \(body)")
            throw NetworkError.invalidResponse
        }

        do {
            return try JSONDecoder().decode(MyProfileResponse.self, from: data)
        } catch {
            NetworkManager.lastError = "Profile decode: \(error.localizedDescription)"
            throw error
        }
    }

    // MARK: - Fetch Friends with Updates (/api/user/friends/updates/)
    private func fetchFriendsWithUpdates(csrf: String, token: String) async throws -> [FriendUpdate] {
        let url = URL(string: "\(baseURL)/api/user/friends/updates/")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("csrftoken=\(csrf); access_token=\(token)", forHTTPHeaderField: "Cookie")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            NetworkManager.lastError = "Net Fr: \(error.localizedDescription.prefix(25))"
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            print("[Widget] fetchFriendsWithUpdates: Invalid response type")
            throw NetworkError.invalidResponse
        }

        NetworkManager.lastFriendsStatus = httpResponse.statusCode
        print("[Widget] fetchFriendsWithUpdates status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            NetworkManager.lastError = "Friends: \(httpResponse.statusCode)"
            print("[Widget] fetchFriendsWithUpdates failed: \(body)")
            throw NetworkError.invalidResponse
        }

        do {
            // Try paginated response first, fallback to direct array
            if let paginatedResponse = try? JSONDecoder().decode(PaginatedResponse<FriendUpdate>.self, from: data) {
                return paginatedResponse.results
            }
            // Fallback: API returns array directly
            return try JSONDecoder().decode([FriendUpdate].self, from: data)
        } catch {
            NetworkManager.lastError = "Friends decode: \(error.localizedDescription)"
            throw error
        }
    }

    // MARK: - Fetch Playlist Feed (/api/playlist/feed)
    private func fetchPlaylistFeed(csrf: String, token: String) async throws -> [PlaylistSong] {
        let url = URL(string: "\(baseURL)/api/playlist/feed")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("csrftoken=\(csrf); access_token=\(token)", forHTTPHeaderField: "Cookie")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            NetworkManager.lastError = "Net Pl: \(error.localizedDescription.prefix(25))"
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            print("[Widget] fetchPlaylistFeed: Invalid response type")
            throw NetworkError.invalidResponse
        }

        NetworkManager.lastPlaylistStatus = httpResponse.statusCode
        print("[Widget] fetchPlaylistFeed status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            NetworkManager.lastError = "Playlist: \(httpResponse.statusCode)"
            print("[Widget] fetchPlaylistFeed failed: \(body)")
            throw NetworkError.invalidResponse
        }

        do {
            // API returns paginated response with results array
            let paginatedResponse = try JSONDecoder().decode(PaginatedResponse<PlaylistSong>.self, from: data)
            return paginatedResponse.results
        } catch {
            NetworkManager.lastError = "Playlist decode: \(error.localizedDescription)"
            throw error
        }
    }

    enum NetworkError: Error {
        case notAuthenticated
        case invalidResponse
    }
}
