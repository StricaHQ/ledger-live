"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var react_native_1 = require("react-native");
var hw_transport_1 = __importDefault(require("@ledgerhq/hw-transport"));
var logs_1 = require("@ledgerhq/logs");
var EventEmitter_1 = __importDefault(require("./EventEmitter"));
var NativeBle = react_native_1.NativeModules.HwTransportReactNativeBle;
/**
 * Allows for us to reuse a transport instance instead of instantiating a new
 * one. This should also prevent race conditions since we would know if there
 * is an action pending on the device via the internal state of the transport.
 */
var transportsCache = {};
var Ble = /** @class */ (function (_super) {
    __extends(Ble, _super);
    function Ble(deviceId // TODO to be made a Device
    // deviceModel: DeviceModel
    ) {
        var _this = _super.call(this) || this;
        // To be called from live-common-setup (?) and removed afterwards?
        // Not sure whether we need to cleanup or not if only invoked once
        _this.listenToAppStateChanges = function () {
            _this.appStateSubscription = react_native_1.AppState.addEventListener('change', function (state) {
                switch (state) {
                    case 'active':
                        NativeBle.onAppStateChange(true);
                        break;
                    case 'inactive':
                        NativeBle.onAppStateChange(false);
                        break;
                }
            });
        };
        /// Exchange an apdu with a device
        _this.exchange = function (apdu) {
            var apduString = apdu.toString('hex');
            (0, logs_1.log)('apdu', "=> ".concat(apduString));
            return new Promise(function (f, r) {
                return NativeBle.exchange(apduString, Ble.promisify(f, r));
            }).then(function (response) {
                (0, logs_1.log)('apdu', "<= ".concat(response));
                return response;
            });
        };
        _this.id = deviceId;
        _this.listenToAppStateChanges(); // TODO cleanup chores, keep track of instances
        (0, logs_1.log)('ble-verbose', "BleTransport(".concat(String(_this.id), ") new instance"));
        return _this;
    }
    /// TODO events and whatnot
    Ble.listen = function (observer) {
        (0, logs_1.log)('ble-verbose', 'listen...');
        if (!Ble.isScanning) {
            Ble.isScanning = true;
            Ble.scanObserver = observer;
            NativeBle.listen();
        }
        // Provide a way to cleanup after a listen
        var unsubscribe = function () {
            Ble.stop();
            (0, logs_1.log)('ble-verbose', 'done listening.');
        };
        return {
            unsubscribe: unsubscribe
        };
    };
    var _a;
    _a = Ble;
    Ble.appState = 'background';
    Ble.uuid = ''; // follow the Device model instead of uuid
    Ble.isScanning = false;
    Ble.listeners = EventEmitter_1["default"] === null || EventEmitter_1["default"] === void 0 ? void 0 : EventEmitter_1["default"].addListener('BleTransport', function (rawEvent) {
        var _b = JSON.parse(rawEvent), event = _b.event, type = _b.type, data = _b.data;
        switch (event) {
            case 'status':
                /// Status handling
                (0, logs_1.log)('ble', type);
                switch (type) {
                    case 'start-scanning':
                        Ble.isScanning = true;
                        break;
                    case 'stop-scanning':
                        Ble.isScanning = false;
                        break;
                }
                break;
            case 'task':
                switch (type) {
                    case 'bulk-progress':
                        (0, logs_1.log)('ble', "bulk-progress ".concat(Math.round(data === null || data === void 0 ? void 0 : data.progress)));
                        break;
                    default:
                        (0, logs_1.log)('ble', type);
                        break;
                }
                break;
            case 'new-device':
                Ble.scanObserver.next(data); // Polyfill with device data based on serviceUUID?
                break;
        }
    });
    Ble.stop = function () {
        Ble.isScanning = false;
        NativeBle.stop();
    };
    /// Attempt to connect to a device
    Ble.open = function (_uuid) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(_a, function (_b) {
            if (transportsCache[_uuid]) {
                (0, logs_1.log)('ble-verbose', 'Transport in cache, using that.');
                return [2 /*return*/, transportsCache[_uuid]];
            }
            (0, logs_1.log)('ble-verbose', "connecting (".concat(_uuid, ")"));
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    NativeBle.connect(_uuid, Ble.promisify(function () {
                        (0, logs_1.log)('ble-verbose', "connected to (".concat(_uuid, ")"));
                        var transport = new Ble(_uuid);
                        transportsCache[_uuid] = transport;
                        resolve(transport);
                    }, function () {
                        (0, logs_1.log)('ble-verbose', "failed to connect to device");
                        reject(new Error('failed!')); // Use error?
                    }));
                })];
        });
    }); };
    /// Globally disconnect from a connected device
    Ble.disconnect = function () {
        (0, logs_1.log)('ble-verbose', "disconnecting"); // Thought about multi devices?
        return new Promise(function (f, r) {
            return NativeBle.disconnect(Ble.promisify(f, r));
        }).then(function (result) {
            transportsCache = {};
            return result;
        });
    };
    // React-Native modules use error-first Node-style callbacks
    // we promisify them to handle inasync/await pattern instead
    Ble.promisify = function (resolve, reject) { return function (e, result) {
        if (e) {
            reject(Ble.mapError(e)); // TODO introduce some error mapping
            return;
        }
        resolve(result);
    }; };
    // Map the received error string to a known (or generic) error
    // that we can handle correctly.
    Ble.mapError = function (error) {
        switch (error) {
            case 'user-pending-action':
                return new Error('Action was pending yada yada');
            default:
                return new Error('generic');
        }
    };
    Ble.runner = function (url) {
        // DO it dynamically
        (0, logs_1.log)('ble-verbose', "request to launch runner for url ".concat(url));
        NativeBle.runner(url);
    };
    return Ble;
}(hw_transport_1["default"]));
exports["default"] = Ble;
//# sourceMappingURL=TransportBLE.js.map