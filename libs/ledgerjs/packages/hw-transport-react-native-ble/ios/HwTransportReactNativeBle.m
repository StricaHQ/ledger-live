#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(HwTransportReactNativeBle, RCTEventEmitter)


RCT_EXTERN_METHOD(listen)
RCT_EXTERN_METHOD(stop)
RCT_EXTERN_METHOD(connect: (NSString *) string callback:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(disconnect: (RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(exchange: (NSString *) apdu callback:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(onAppStateChange: (BOOL *) awake)
RCT_EXTERN_METHOD(runner: (NSString *) url)
@end
