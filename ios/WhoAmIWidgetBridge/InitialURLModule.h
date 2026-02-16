#import <Foundation/Foundation.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Call from AppDelegate when application:openURL:options is invoked.
/// This allows getStoredInitialURL (used by JS) to return the URL when
/// the app was cold-started from a widget link (URL may not be in launchOptions).
void SetStoredInitialURL(NSString * _Nullable url);

#ifdef __cplusplus
}
#endif
