import Foundation
import WidgetKit

/// Shared network utilities for widget self-fetch.
/// All three widgets use the same cookie-based auth pattern and Spotify oEmbed.
struct WidgetAPIHelper {
    static func apiBaseUrl() -> String {
        SharedDataManager.shared.apiBaseUrl ?? "https://whoami-test-group.gina-park.site/api/"
    }

    /// Build a URLRequest with cookie-based auth headers matching the Android pattern.
    static func authenticatedRequest(for url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        let csrf = SharedDataManager.shared.csrfToken ?? ""
        let access = SharedDataManager.shared.accessToken ?? ""
        request.setValue("csrftoken=\(csrf); access_token=\(access)", forHTTPHeaderField: "Cookie")
        request.setValue(csrf, forHTTPHeaderField: "X-CSRFToken")
        return request
    }

    /// Fetch album/thumbnail URL from Spotify oEmbed (no auth required).
    static func fetchSpotifyAlbumImageUrl(trackId: String) async -> URL? {
        let trackUrl = "https://open.spotify.com/track/\(trackId)"
        guard let encodedTrackUrl = trackUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://open.spotify.com/oembed?url=\(encodedTrackUrl)") else {
            return nil
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            if let thumbnailUrl = json?["thumbnail_url"] as? String {
                return URL(string: thumbnailUrl)
            }
        } catch { }
        return nil
    }

    /// Download binary image data from a URL.
    static func downloadImageData(from url: URL) async -> Data? {
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return data
        } catch {
            return nil
        }
    }

    /// Fetch JSON from an authenticated API endpoint.
    static func fetchJSON(endpoint: String) async -> [String: Any]? {
        let base = apiBaseUrl()
        guard let url = URL(string: base + endpoint) else { return nil }
        let request = authenticatedRequest(for: url)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return nil }
            return try JSONSerialization.jsonObject(with: data) as? [String: Any]
        } catch {
            return nil
        }
    }

    private static let appGroupId = "group.com.whoami.today.app"

    private static func appGroupRootURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
    }

    /// Store a Codable-compatible dictionary as JSON Data in the App Group.
    static func storeJSON(_ dict: [String: Any], forKey key: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.set(data, forKey: key)
        defaults?.synchronize()
        // Mirror files so the widget reads the same data when UserDefaults is stale (matches RN `syncMyCheckIn`).
        if key == "my_check_in", let url = appGroupRootURL()?.appendingPathComponent("my_check_in.json") {
            try? data.write(to: url, options: .atomic)
        }
    }

    /// Store binary data in the App Group.
    static func storeData(_ data: Data, forKey key: String) {
        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.set(data, forKey: key)
        defaults?.synchronize()
        if key == "widget_album_image", let url = appGroupRootURL()?.appendingPathComponent("widget_album_image.bin") {
            try? data.write(to: url, options: .atomic)
        }
    }
}
