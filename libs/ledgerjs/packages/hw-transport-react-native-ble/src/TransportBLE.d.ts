/// <reference types="node" />
import Transport from '@ledgerhq/hw-transport';
declare class Ble extends Transport {
    static appState: String;
    static appStateSubscription: any;
    static uuid: String;
    static scanObserver: any;
    static isScanning: Boolean;
    id: String;
    appStateSubscription: any;
    constructor(deviceId: String);
    private listenToAppStateChanges;
    static listeners: any;
    static listen(observer: any): {
        unsubscribe: () => void;
    };
    private static stop;
    static open: (_uuid: string) => Promise<any>;
    static disconnect: () => Promise<any>;
    exchange: (apdu: Buffer) => Promise<any>;
    private static promisify;
    private static mapError;
    static runner: (url: any) => void;
}
export default Ble;
//# sourceMappingURL=TransportBLE.d.ts.map