import Foundation
import BleTransport
import Bluejay
import CoreBluetooth


@objc(HwTransportReactNativeBle)
class HwTransportReactNativeBle: RCTEventEmitter {
    var runnerTask: Runner?
    var queueTask: Queue?
    var lastSeenSize: Int = 0
    var seenDevicesByUUID : [String: PeripheralIdentifier] = [:]
    
    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override init() {
        super.init()
        print(BleTransport.shared)
        EventEmitter.sharedInstance.registerEventEmitter(eventEmitter: self)
    }
    
    /// Wrapper over the event dispatch for reusability as a callback
    private func emitFromRunner(_ type: Action, withData: ExtraData?) -> Void {
        EventEmitter.sharedInstance.dispatch(
            event: Event.task,
            type: type.rawValue,
            data: withData
        )
    }
    
    /// I don't know why I still have this but it's not hurting anyone for now
    private func blackHole (reason : String, lastMessage: String) -> Void {
        print("blackhole", reason, lastMessage)
        self.queueTask = nil
        self.runnerTask = nil
    }
    
    
    
    /// Start scanning for available devices
    ///
    ///- Parameter resolve: We have succeeded at _starting_ to scan. Does not mean we saw devices
    ///- Parameter reject: Unable to scan for devices
    ///
    @objc func listen(_ resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        if !BleTransport.shared.isBluetoothAvailable {
            reject(TransportError.bluetoothRequired.rawValue, "", nil)
        } else if BleTransport.shared.bluejay.isConnected {
            DispatchQueue.main.async { [self] in
                BleTransport.shared.disconnect(immediate: false){ [self]_ in
                    listenImpl()
                    resolve(true)
                }
            }
        } else {
            listenImpl()
            resolve(true)
        }
    }
    
    private func listenImpl() -> Void {
        self.seenDevicesByUUID = [:]
        self.lastSeenSize = 0
        
        DispatchQueue.main.async { [self] in
            BleTransport.shared.scan { discoveries in
                if discoveries.count != self.lastSeenSize {
                    self.lastSeenSize = discoveries.count
                    
                    /// Found devices are handled via events since we need more than one call
                    /// We can then polyfill the model and other information based on the service ID
                    /// of the BLE stack
                    discoveries.forEach{
                        self.seenDevicesByUUID[$0.peripheral.uuid.uuidString] = $0.peripheral

                        /// Emit a new device event with all the required information
                        EventEmitter.sharedInstance.dispatch(
                            event: Event.newDevice,
                            type: $0.peripheral.uuid.uuidString,
                            data: ExtraData(
                                uuid: $0.peripheral.uuid.uuidString,
                                name: $0.peripheral.name,
                                service: $0.serviceUUID.uuidString
                            )
                        )
                    }
                }
            } stopped: {_ in }
        }
    }
    
    /// Stop scanning for available devices
    ///
    ///- Parameter resolve: We have succeeded at stopping the scan.
    ///- Parameter reject: Naively unused
    ///
    @objc func stop(_ resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        if BleTransport.shared.isBluetoothAvailable {
            DispatchQueue.main.async {
                BleTransport.shared.stopScanning()
                resolve(true)
                self.seenDevicesByUUID = [:]
                self.lastSeenSize = 0
            }
        }
    }

    /// Used to determine if a device connection is still valid since changing apps invalidates it, if all goes according
    /// to the specs we should disconnect as soon as we finish an interaction, so it's important to check whether
    /// the connection still exists before trying to interact. We also do this, probably redundantly, in the exchange func
    ///
    ///- Parameter resolve: Whether we are connected or not
    ///- Parameter reject: Naively unused
    ///
    @objc func isConnected(_ resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        resolve(BleTransport.shared.bluejay.isConnected)
    }
    
    /// Process a long running task of the Runner type which connects to a scriptrunner endpoint and proxies the
    /// apdus from that HSM to our device while emiting the meaningful events to monitor the progres..
    ///
    ///- Parameter url: Which endpoint to connect to
    ///
    @objc func runner(_ url: String) -> Void {
        self.runnerTask = Runner(
            endpoint: URL(string: url)!,
            onEvent: self.emitFromRunner,
            onDone: self.blackHole
        )
    }
    
    /// Process a long running task of the Queue type or update an ongoing queue if it's already happening.
    /// A queue is essentially a convenience wrapper on top multiple runners although internally it relies on the BIM
    /// backend which abstracts the individual scriptrunner urls for us.
    /// Queues can be stopped by explicitly calling the disconnect on the transport.
    ///
    ///- Parameter token: Base64 encoded string containing a JSON representation of a queue of operations
    ///                   to perform on the devices such as installing or inanstalling specific application.
    ///- Parameter index: Which item of the queue to start working from, this is particularly useful when we
    ///                   replace a token with another one since we likely have processed a few items already
    ///1
    @objc func queue(_ token: String) -> Void {
        if let queue = self.queueTask {
            queue.setToken(token: token)
        }
        else {
            /// Try to run a scriptrunner queue
            self.queueTask = Queue(
                token: token,
                onEvent: self.emitFromRunner,
                onDone: self.blackHole
            )
        }
    }
    
    @objc func stopQueue() -> Void {
        if let queue = self.queueTask {
            queue.stop()
        }
    }


    /// Connect to a device via its uuid
    ///
    ///- Parameter uuid: Unique identifier that represents the Ledger device we want to connect to
    ///- Parameter resolve: UUID of the device we've connected to
    ///- Parameter reject: Unable to establish a connection with the device
    ///
    @objc func connect(_ uuid: String,
                       serviceUUID: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock
    ) -> Void {
        var promiseResolved = false
        if BleTransport.shared.bluejay.isConnected {
            resolve(uuid)
        }
        else if !BleTransport.shared.isBluetoothAvailable {
            reject(TransportError.bluetoothRequired.rawValue, "", nil)
        } else {
            let peripheral = PeripheralIdentifier(uuid: UUID(uuidString: uuid)!, name: "")

            DispatchQueue.main.async {
                BleTransport.shared.connect(toPeripheralID: peripheral) {
                    if !promiseResolved {
                        promiseResolved = true
                        reject(TransportError.cantOpenDevice.rawValue, "", nil)
                    }
                } success: { PeripheralIdentifier in
                    /// On a pairing flow, we'd get a _connect_ but still fail to communicate.
                    /// if the user rejects the pairing, internally the inferMTU fails and we end
                    /// up triggering the failure reject below, in that case, we shouldn't also
                    /// trigger this callback like cavemen.
                    if !promiseResolved {
                        promiseResolved = true
                        resolve(uuid)
                    }
                } failure: { e in
                    if !promiseResolved {
                            promiseResolved = true
                        reject(TransportError.pairingFailed.rawValue, "", nil)
                    }
                }
            }
        }
    }
    
    /// Disconnect from a device and clean up after ourselves. This is particularly important since from a Live
    /// point of view we will be disconnecting actively whenever an exchange completes, it's the perfcect spot
    /// to remove any lingering tasks and flags. We don't check whether we are connected before because the
    /// state may not be visible
    ///
    ///- Parameter resolve: true
    ///- Parameter reject: Naively unused
    ///
    @objc func disconnect(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        DispatchQueue.main.async { [self] in
            /// Perform some cleanup in case we have some long running tasks going on
            if self.queueTask != nil {
                queueTask?.stop()
                queueTask = nil
            }
            
            if self.runnerTask != nil {
                runnerTask?.stop()
                runnerTask = nil
            }

            if !BleTransport.shared.bluejay.isConnected {
                resolve(true)
            } else {
                BleTransport.shared.disconnect(immediate: false, completion: { _ in
                    resolve(true)
                })
            }
        }
    }
    
    /// Send a raw APDU message to the connected device,
    ///
    /// - Parameter apdu: Message to be sent to the device, gets validated internally inside the transport
    /// - Parameter resolve: Response from the device apdu exchange
    /// - Parameter reject: Failed to perform the exchange for a variety of reasons
    ///
    @objc func exchange(_ apdu: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        if !BleTransport.shared.bluejay.isConnected {
            reject(TransportError.deviceDisconnected.rawValue, "", nil)
        } else {
            DispatchQueue.main.async {
                BleTransport.shared.exchange(apdu: APDU(raw: apdu)) { result in
                    switch result {
                    case .success(let response):
                        resolve(response)
                    case .failure(let error):
                        switch error {
                        case .writeError(let description):
                            reject(TransportError.writeError.rawValue, String(describing:description), nil)
                        case .pendingActionOnDevice:
                            reject(TransportError.userPendingAction.rawValue, "", nil)
                        default:
                            reject(TransportError.writeError.rawValue, "", nil)
                        }
                    }
                }
            }
        }
    }
    
    /// React to the application state changes from the JavaScript thread in order to know whether to emit
    /// or not the events from the communication with our devices and services.
    ///
    ///- Parameter awake: Whether the application is in the background or not.
    ///
    @objc func onAppStateChange(_ awake: Bool) -> Void {
        EventEmitter.sharedInstance.onAppStateChange(awake: awake)
    }

    @objc open override func supportedEvents() -> [String] {
        return EventEmitter.sharedInstance.allEvents
    }
}
