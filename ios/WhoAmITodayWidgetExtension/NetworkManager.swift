import Foundation

class NetworkManager {
    static let shared = NetworkManager()
    // TODO(Gina): Update with actual API base URL
    private let baseURL = "https://whoami-admin-group.gina-park.site"

    // DEBUG: Store last API status for display
    static var lastProfileStatus: Int = 0
    static var lastFriendsStatus: Int = 0
    static var lastPlaylistStatus: Int = 0
    static var lastQuestionsStatus: Int = 0
    static var lastError: String = ""
    static var questionsDebugInfo: String = ""  // NEW: detailed question fetch info

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
        async let dailyQuestions = fetchDailyQuestions(csrf: csrfToken, token: accessToken)

        let profileResult = try? await myProfile
        let friendsResult = (try? await friends) ?? []
        let playlistsResult = (try? await playlists) ?? []
        var questionsResult = try? await dailyQuestions

        print("[Widget] Profile result: \(profileResult != nil ? "success" : "nil")")
        print("[Widget] Friends count: \(friendsResult.count)")
        print("[Widget] Playlists count: \(playlistsResult.count)")
        print("[Widget] Daily questions result: \(questionsResult != nil ? "success (\(questionsResult?.count ?? 0) questions)" : "nil")")

        // Fallback to general questions if daily questions failed or empty
        if questionsResult == nil || questionsResult?.isEmpty == true {
            let dailyWasEmpty = questionsResult?.isEmpty == true
            NetworkManager.questionsDebugInfo = "Daily: \(dailyWasEmpty ? "empty[]" : "failed")"
            print("[Widget] Daily questions empty or failed, trying general questions...")

            do {
                questionsResult = try await fetchGeneralQuestions(csrf: csrfToken, token: accessToken)
                print("[Widget] General questions fallback result: success (\(questionsResult?.count ?? 0) questions)")
                NetworkManager.questionsDebugInfo += " → Gen: OK (\(questionsResult?.count ?? 0))"
            } catch {
                print("[Widget] General questions error: \(error)")
                NetworkManager.questionsDebugInfo += " → Gen: ERR[\(error)]"
                questionsResult = nil
            }
        } else {
            NetworkManager.questionsDebugInfo = "Daily: OK (\(questionsResult?.count ?? 0))"
        }

        if let firstQuestion = questionsResult?.first {
            print("[Widget] First question content: \(firstQuestion.content)")
            NetworkManager.questionsDebugInfo += " | Content: \(firstQuestion.content.prefix(50))"
        } else {
            NetworkManager.questionsDebugInfo += " | NO QUESTION FOUND"
        }

        // Use myCheckIn from SharedDataManager (synced from RN with album image) if available,
        // otherwise fall back to API data
        var myCheckInData = SharedDataManager.shared.myCheckIn ?? profileResult?.checkIn
        let source = SharedDataManager.shared.myCheckIn != nil ? "SharedDataManager" : "API"
        print("[Widget] fetchWidgetData: myCheckIn from \(source), mood: \(myCheckInData?.mood ?? "nil")")

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
            questionOfDay: questionsResult?.first,
            lastUpdated: Date()
        )

        // Cache the data
        SharedDataManager.shared.cachedWidgetData = data

        print("[Widget] Data cached successfully")

        return data
    }

    /// Validate that stored tokens are still valid (API returns 200 for /api/user/me/profile).
    /// Use this so widget shows "Please Sign in" when user logged out in WebView but tokens remain in App Group.
    func validateToken() async -> Bool {
        guard let csrf = SharedDataManager.shared.csrfToken,
              let token = SharedDataManager.shared.accessToken,
              !csrf.isEmpty, !token.isEmpty else {
            return false
        }
        do {
            _ = try await fetchMyProfile(csrf: csrf, token: token)
            NSLog("[Widget] validateToken: 200 OK, token valid")
            return true
        } catch {
            NSLog("[Widget] validateToken failed (treat as logged out): %@", String(describing: error))
            return false
        }
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

    // MARK: - Fetch Daily Questions (/api/qna/questions/daily/)
    private func fetchDailyQuestions(csrf: String, token: String) async throws -> [QuestionOfDay] {
        let url = URL(string: "\(baseURL)/api/qna/questions/daily/")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("csrftoken=\(csrf); access_token=\(token)", forHTTPHeaderField: "Cookie")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            print("[Widget] fetchDailyQuestions network error: \(error)")
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            print("[Widget] fetchDailyQuestions: Invalid response type")
            throw NetworkError.invalidResponse
        }

        NetworkManager.lastQuestionsStatus = httpResponse.statusCode
        print("[Widget] fetchDailyQuestions status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            NetworkManager.lastError = "Questions: \(httpResponse.statusCode)"
            print("[Widget] fetchDailyQuestions failed: \(body)")
            throw NetworkError.invalidResponse
        }

        // Log raw response for debugging
        if let responseBody = String(data: data, encoding: .utf8) {
            print("[Widget] Daily questions raw response (first 500 chars): \(responseBody.prefix(500))")
        }

        do {
            // API returns an array of questions directly
            let questions = try JSONDecoder().decode([QuestionOfDay].self, from: data)
            print("[Widget] ✅ Successfully decoded \(questions.count) daily questions")
            if questions.isEmpty {
                print("[Widget] ⚠️ Daily questions array is EMPTY!")
            }
            return questions
        } catch {
            print("[Widget] ❌ fetchDailyQuestions decode error: \(error)")
            print("[Widget] Error details: \(error.localizedDescription)")
            throw error
        }
    }

    // MARK: - Fetch General Questions (/api/qna/questions/) - Fallback
    private func fetchGeneralQuestions(csrf: String, token: String) async throws -> [QuestionOfDay] {
        let url = URL(string: "\(baseURL)/api/qna/questions/?page=1")!
        var request = URLRequest(url: url)
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        request.setValue("csrftoken=\(csrf); access_token=\(token)", forHTTPHeaderField: "Cookie")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            print("[Widget] fetchGeneralQuestions network error: \(error)")
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            print("[Widget] fetchGeneralQuestions: Invalid response type")
            throw NetworkError.invalidResponse
        }

        print("[Widget] fetchGeneralQuestions status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            NetworkManager.lastError = "General Q: \(httpResponse.statusCode)"
            print("[Widget] fetchGeneralQuestions failed: \(body)")
            throw NetworkError.invalidResponse
        }

        // Log raw response for debugging
        if let responseBody = String(data: data, encoding: .utf8) {
            print("[Widget] General questions raw response (first 500 chars): \(responseBody.prefix(500))")
        }

        do {
            // API returns paginated response with QuestionGroup array
            let paginatedResponse = try JSONDecoder().decode(PaginatedResponse<QuestionGroup>.self, from: data)
            print("[Widget] ✅ General questions decoded: \(paginatedResponse.results.count) groups")

            if paginatedResponse.results.isEmpty {
                print("[Widget] ⚠️ Results array is EMPTY!")
                return []
            }

            // Get first question from first group
            if let firstGroup = paginatedResponse.results.first {
                print("[Widget] First group date: \(firstGroup.date), questions count: \(firstGroup.questions.count)")

                if firstGroup.questions.isEmpty {
                    print("[Widget] ⚠️ First group has NO questions!")
                    return []
                }

                if let firstQuestion = firstGroup.questions.first {
                    print("[Widget] ✅ Using fallback question - ID: \(firstQuestion.id), Content: \(firstQuestion.content)")
                    return [firstQuestion.toQuestionOfDay()]
                }
            }

            print("[Widget] ⚠️ Could not extract first question from results")
            return []
        } catch {
            print("[Widget] ❌ fetchGeneralQuestions decode error: \(error)")
            print("[Widget] Error details: \(error.localizedDescription)")
            throw error
        }
    }

    enum NetworkError: Error {
        case notAuthenticated
        case invalidResponse
    }
}
