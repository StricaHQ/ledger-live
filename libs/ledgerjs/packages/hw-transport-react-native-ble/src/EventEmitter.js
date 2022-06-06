"use strict";
exports.__esModule = true;
var react_native_1 = require("react-native");
exports["default"] = react_native_1.Platform.select({
    ios: new react_native_1.NativeEventEmitter(react_native_1.NativeModules.HwTransportReactNativeBle),
    android: react_native_1.DeviceEventEmitter
});
//# sourceMappingURL=EventEmitter.js.map