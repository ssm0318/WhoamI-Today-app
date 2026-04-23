#import <Firebase.h>
#import "AppDelegate.h"
#import "RNBootSplash.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import "InitialURLModule.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
  }

  self.moduleName = @"whoami-today";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
  return true;
}

- (UIView *)createRootViewWithBridge:(RCTBridge *)bridge
                          moduleName:(NSString *)moduleName
                           initProps:(NSDictionary *)initProps {
  UIView *rootView = [super createRootViewWithBridge:bridge
                                          moduleName:moduleName
                                           initProps:initProps];

  [RNBootSplash initWithStoryboard:@"BootSplash" rootView:rootView]; 

  return rootView;
}

// Handle deep links from widget
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  // Store URL so getInitialURL can return it when app was cold-started from widget
  // (launchOptions may not contain the URL in that case)
  if (url.absoluteString.length > 0) {
    SetStoredInitialURL(url.absoluteString);
  }
  return [RCTLinkingManager application:application openURL:url options:options];
}

// Handle universal links
- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
    restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *))restorationHandler
{
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

@end
