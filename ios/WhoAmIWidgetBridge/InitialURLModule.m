#import "InitialURLModule.h"
#import <React/RCTBridgeModule.h>

static NSString *_Nullable gStoredInitialURL = nil;
static dispatch_queue_t gStoredInitialURLQueue = nil;

__attribute__((constructor))
static void InitStoredInitialURLQueue(void) {
    gStoredInitialURLQueue = dispatch_queue_create(
        "com.whoami.today.InitialURLModule.store", DISPATCH_QUEUE_SERIAL);
}

void SetStoredInitialURL(NSString * _Nullable url) {
    NSString *copy = [url copy];
    dispatch_sync(gStoredInitialURLQueue, ^{
        gStoredInitialURL = copy;
    });
}

static NSString *_Nullable GetStoredInitialURL(void) {
    __block NSString *result = nil;
    dispatch_sync(gStoredInitialURLQueue, ^{
        result = gStoredInitialURL;
    });
    return result;
}

@interface InitialURLModule : NSObject <RCTBridgeModule>
@end

@implementation InitialURLModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(getStoredInitialURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *url = GetStoredInitialURL();
    resolve(url ?: [NSNull null]);
}

RCT_EXPORT_METHOD(clearStoredInitialURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    SetStoredInitialURL(nil);
    resolve(nil);
}

@end
