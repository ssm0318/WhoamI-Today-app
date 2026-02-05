import Foundation

// MARK: - Spotify Track Model
struct SpotifyTrack: Codable {
    let id: String
    let name: String
    let artists: [SpotifyArtist]
    let album: SpotifyAlbum

    var artistName: String {
        artists.first?.name ?? "Unknown Artist"
    }

    var albumImageUrl: String? {
        album.images.first?.url
    }
}

struct SpotifyArtist: Codable {
    let id: String
    let name: String
}

struct SpotifyAlbum: Codable {
    let id: String
    let name: String
    let images: [SpotifyImage]
}

struct SpotifyImage: Codable {
    let url: String
    let height: Int?
    let width: Int?
}

// MARK: - Spotify Token Response
struct SpotifyTokenResponse: Codable {
    let accessToken: String
    let tokenType: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
    }
}

// MARK: - Spotify Manager
class SpotifyManager {
    static let shared = SpotifyManager()

    private var accessToken: String?
    private var tokenExpiry: Date?

    private var clientId: String? {
        SharedDataManager.shared.spotifyClientId
    }

    private var clientSecret: String? {
        SharedDataManager.shared.spotifyClientSecret
    }

    var isConfigured: Bool {
        SharedDataManager.shared.hasSpotifyCredentials
    }

    // MARK: - Get Access Token (Client Credentials Flow)
    private func getAccessToken() async throws -> String {
        // Return cached token if still valid
        if let token = accessToken, let expiry = tokenExpiry, Date() < expiry {
            return token
        }

        guard let clientId = clientId, let clientSecret = clientSecret else {
            throw SpotifyError.notConfigured
        }

        let url = URL(string: "https://accounts.spotify.com/api/token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        // Basic auth header
        let credentials = "\(clientId):\(clientSecret)"
        let encodedCredentials = Data(credentials.utf8).base64EncodedString()
        request.setValue("Basic \(encodedCredentials)", forHTTPHeaderField: "Authorization")

        // Body
        request.httpBody = "grant_type=client_credentials".data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw SpotifyError.authenticationFailed
        }

        let tokenResponse = try JSONDecoder().decode(SpotifyTokenResponse.self, from: data)
        self.accessToken = tokenResponse.accessToken
        self.tokenExpiry = Date().addingTimeInterval(TimeInterval(tokenResponse.expiresIn - 60)) // Expire 1 min early

        return tokenResponse.accessToken
    }

    // MARK: - Get Track Info
    func getTrack(trackId: String) async throws -> SpotifyTrack {
        let token = try await getAccessToken()

        let url = URL(string: "https://api.spotify.com/v1/tracks/\(trackId)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw SpotifyError.trackNotFound
        }

        return try JSONDecoder().decode(SpotifyTrack.self, from: data)
    }

    enum SpotifyError: Error {
        case notConfigured
        case authenticationFailed
        case trackNotFound
    }
}
