import { AppState, NativeModules } from "react-native";
import Transport, {
  DescriptorEvent,
  Device,
  Observer,
  Subscription,
} from "@ledgerhq/hw-transport";
import {
  PairingFailed,
  TransportError,
  BluetoothRequired,
} from "@ledgerhq/errors";
import { type EventSubscription } from "react-native/Libraries/vendor/emitter/EventEmitter";
import EventEmitter from "./EventEmitter";

const NativeBle = NativeModules.HwTransportReactNativeBle;

let instances: Array<Ble> = [];
class Ble extends Transport {
  static scanObserver: Observer<DescriptorEvent<unknown>>;

  appStateSubscription: EventSubscription;
  appState: "background" | "active" | "inactive" | "" = "";
  id: string;

  static log(...m: string[]): void {
    const tag = "ble-verbose";
    console.log(tag, ...m);
  }

  constructor(deviceId: string) {
    super();
    this.id = deviceId;
    this.listenToAppStateChanges(); // TODO cleanup chores, keep track of instances
    Ble.log(`BleTransport(${String(this.id)}) new instance`);
  }

  private listenToAppStateChanges = () => {
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      if (this.appState !== state) {
        Ble.log("appstate change detected", state);
        this.appState = state;
        NativeBle.onAppStateChange(state === "active");
      }
    });
  };

  exchange = async (apdu: Buffer): Promise<Buffer> => {
    Ble.log("apdu", `=> ${apdu.toString("hex")}`);
    try {
      const response = await NativeBle.exchange(apdu.toString("hex"));
      Ble.log("apdu", `<= ${response}`);
      return Buffer.from(`${response}`, "hex");
    } catch (error) {
      throw Ble.remapError(error);
    }
  };

  // TODO this seems to be going to leak since we never stop listening
  static listener = EventEmitter?.addListener("BleTransport", (rawEvent) => {
    const { event, data } = JSON.parse(rawEvent); //Nb event === "task" type === "bulk-progress"
    if (event === "new-device") {
      Ble.scanObserver?.next({
        type: "add",
        descriptor: {
          id: data.uuid,
          name: data.name,
          serviceUUIDs: [data.service],
        },
      });
    }
  });

  static listen = (
    observer: Observer<DescriptorEvent<unknown>>
  ): Subscription => {
    Ble.scanObserver = observer;
    NativeBle.listen()
      .then(() => {
        Ble.log("Start scanning devices");
      })
      .catch((error) => {
        Ble.log("Bluetooth is not available! :ohgod:");
        observer.error(Ble.remapError(error));
      });

    return { unsubscribe: Ble.stop };
  };

  private static stop = async (): Promise<void> => {
    await NativeBle.stop();
    Ble.log("Stop scanning devices");
  };

  static open = async (deviceOrId: Device | string): Promise<Ble> => {
    const uuid = typeof deviceOrId === "string" ? deviceOrId : deviceOrId.id;

    if (await Ble.isConnected()) {
      Ble.log("disconnect first");
      await Ble.disconnect();
    }

    Ble.log(`connecting to (${uuid})`);

    try {
      const _uuid = await NativeBle.connect(uuid);
      Ble.log(`connected to (${_uuid})`);
      return new Ble(_uuid);
    } catch (error) {
      Ble.log("failed to connect to device");
      throw Ble.remapError(error, { uuid });
    }
  };

  static disconnect = async (): Promise<boolean> => {
    Ble.log("disconnecting, and removing listeners");
    instances.forEach((instance) => instance.appStateSubscription?.remove());
    instances = [];

    await NativeBle.disconnect();
    Ble.log("disconnected");
    return true;
  };

  static isConnected = (): Promise<boolean> => {
    Ble.log("checking connection");
    return NativeBle.isConnected();
  };

  private static remapError = (error: any, extras?: unknown) => {
    const mappedErrors = {
      "pairing-failed": PairingFailed,
      "bluetooth-required": BluetoothRequired,
    };

    if (error?.code in mappedErrors)
      return new mappedErrors[error?.code](extras);
    return new TransportError(error?.code, error);
  };

  /// Long running tasks below, buckle up.
  static runner = (url: string): void => {
    Ble.log(`request to launch runner for url ${url}`);
    NativeBle.runner(url);
  };

  static queue = (token: string, index: number): void => {
    Ble.log("request to launch queue");
    NativeBle.queue(token, "" + index);
    // Regarding ↑ there's a bug in this rn version that breaks the mapping
    // between a number on the JS side and Swift. To preserve my sanity, we
    // are using string in the meantime since it's not a big deal.
  };
}

export default Ble;
