import Foundation

/// Writes NDJSON debug lines to app group file. Copy to .cursor/debug.log for analysis.
enum WidgetDebugLog {
    private static let filename = "widget_debug.log"

    static func log(location: String, message: String, data: [String: Any], hypothesisId: String) {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.whoami.today.app") else { return }
        let fileURL = container.appendingPathComponent(filename)
        var dict: [String: Any] = [
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "location": location,
            "message": message,
            "hypothesisId": hypothesisId,
        ]
        for (k, v) in data { dict[k] = v }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: dict),
              let line = String(data: jsonData, encoding: .utf8) else { return }
        let lineWithNewline = line + "\n"
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            try? FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? Data().write(to: fileURL)
        }
        if let handle = try? FileHandle(forWritingTo: fileURL) {
            handle.seekToEndOfFile()
            handle.write(Data(lineWithNewline.utf8))
            try? handle.close()
        }
    }
}
