import WidgetKit
import SwiftUI

@main
struct WhoAmITodayWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PhotoWidget()
        AlbumCoverWidget()
        CheckinWidget()
    }
}
