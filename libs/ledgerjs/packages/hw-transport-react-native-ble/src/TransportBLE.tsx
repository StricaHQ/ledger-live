import { AppState, NativeModules } from 'react-native';
import Transport from '@ledgerhq/hw-transport';
import { log } from '@ledgerhq/logs';
import EventEmitter from './EventEmitter';

const NativeBle = NativeModules.HwTransportReactNativeBle;

/**
 * Allows for us to reuse a transport instance instead of instantiating a new
 * one. This should also prevent race conditions since we would know if there
 * is an action pending on the device via the internal state of the transport.
 */
let transportsCache: { [key: string]: any } = {};
class Ble extends Transport {
  static appState: String = 'background';
  static appStateSubscription: any;
  static uuid: String = ''; // follow the Device model instead of uuid
  static scanObserver: any;
  static isScanning: Boolean = false;

  id: String;
  appStateSubscription: any;
  constructor(
    deviceId: String // TODO to be made a Device
    // deviceModel: DeviceModel
  ) {
    super();
    this.id = deviceId;
    this.listenToAppStateChanges(); // TODO cleanup chores, keep track of instances
    log('ble-verbose', `BleTransport(${String(this.id)}) new instance`);
  }

  // To be called from live-common-setup (?) and removed afterwards?
  // Not sure whether we need to cleanup or not if only invoked once
  private listenToAppStateChanges = () => {
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
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

  static listeners = EventEmitter?.addListener('BleTransport', (rawEvent) => {
    const { event, type, data } = JSON.parse(rawEvent);

    switch (event) {
      case 'status':
        /// Status handling
        log('ble', type);
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
            log('ble', `bulk-progress ${Math.round(data?.progress)}`);
            break;
          default:
            log('ble', type);
            break;
        }
        break;
      case 'new-device':
        Ble.scanObserver.next(data); // Polyfill with device data based on serviceUUID?
        break;
    }
  });

  /// TODO events and whatnot
  static listen(observer: any) {
    log('ble-verbose', 'listen...');
    if (!Ble.isScanning) {
      Ble.isScanning = true;
      Ble.scanObserver = observer;
      NativeBle.listen();
    }

    // Provide a way to cleanup after a listen
    const unsubscribe = () => {
      Ble.stop();
      log('ble-verbose', 'done listening.');
    };

    return {
      unsubscribe,
    };
  }

  private static stop = (): void => {
    Ble.isScanning = false;
    NativeBle.stop();
  };

  /// Attempt to connect to a device
  static open = async (_uuid: string): Promise<any> => {
    if (transportsCache[_uuid]) {
      log('ble-verbose', 'Transport in cache, using that.');
      return transportsCache[_uuid];
    }

    log('ble-verbose', `connecting (${_uuid})`);

    return new Promise((resolve, reject) => {
      NativeBle.connect(
        _uuid,
        Ble.promisify(
          () => {
            log('ble-verbose', `connected to (${_uuid})`);
            const transport = new Ble(_uuid);
            transportsCache[_uuid] = transport;
            resolve(transport);
          },
          () => {
            log('ble-verbose', `failed to connect to device`);
            reject(new Error('failed!')); // Use error?
          }
        )
      );
    });
  };

  /// Globally disconnect from a connected device
  static disconnect = (): Promise<any> => {
    log('ble-verbose', `disconnecting`); // Thought about multi devices?
    return new Promise((f, r) =>
      NativeBle.disconnect(Ble.promisify(f, r))
    ).then((result) => {
      transportsCache = {};
      return result;
    });
  };

  /// Exchange an apdu with a device
  exchange = (apdu: Buffer): Promise<any> => {
    const apduString = apdu.toString('hex');
    log('apdu', `=> ${apduString}`);

    return new Promise((f, r) =>
      NativeBle.exchange(apduString, Ble.promisify(f, r))
    ).then((response) => {
      log('apdu', `<= ${response}`);
      return response;
    });
  };

  // React-Native modules use error-first Node-style callbacks
  // we promisify them to handle inasync/await pattern instead
  private static promisify = (resolve, reject) => (e, result) => {
    if (e) {
      reject(Ble.mapError(e)); // TODO introduce some error mapping
      return;
    }
    resolve(result);
  };

  // Map the received error string to a known (or generic) error
  // that we can handle correctly.
  private static mapError = (error: String) => {
    switch (error) {
      case 'user-pending-action':
        return new Error('Action was pending yada yada');
      default:
        return new Error('generic');
    }
  };

  static runner = (url) => {
    // DO it dynamically
    log('ble-verbose', `request to launch runner for url ${url}`);
    NativeBle.runner(url);
  };
}

export default Ble;
