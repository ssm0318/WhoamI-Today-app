#import "InitialURLModule.h"
#import <React/RCTBridgeModule.h>

static NSString *_Nullable gStoredInitialURL = nil;

void SetStoredInitialURL(NSString * _Nullable url) {
  gStoredInitialURL = url;
}

@interface InitialURLModule : NSObject <RCTBridgeModule>
@end

@implementation InitialURLModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getStoredInitialURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(gStoredInitialURL ?: [NSNull null]);
}

RCT_EXPORT_METHOD(clearStoredInitialURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  gStoredInitialURL = nil;
  resolve(nil);
}

@end
