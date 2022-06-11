import Foundation
import BleTransport
import Bluejay


@objc(HwTransportReactNativeBle)
class HwTransportReactNativeBle: RCTEventEmitter {
    var transport: BleTransport? = nil
    var isConnected: Bool = false
    var runnerTask: Runner?
    var queueTask: Queue?
    var lastSeenSize: Int = 0
    var seenDevicesByUUID : [String: PeripheralIdentifier] = [:]
    
    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override init() {
        self.transport = BleTransport(configuration: nil, debugMode: true)
        super.init()
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
        if let transport = transport {
            if !transport.isBluetoothAvailable {
                reject(TransportError.bluetoothRequired.rawValue, "", nil)
            } else if transport.isConnected { /// Triple check we aren't connected, if this fails we'd need to throw
                transport.disconnect(immediate: false){ [self]_ in
                    listenImpl()
                    resolve(true)
                }
            } else {
                listenImpl()
                resolve(true)
            }
        }
    }
    
    private func listenImpl() -> Void{
        /// To allow for subsequent scans
        self.seenDevicesByUUID = [:]
        self.lastSeenSize = 0
        
        DispatchQueue.main.async { [self] in /// Seems like I'm going to have to do this all the time
            transport!.scan { discoveries in
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
            } stopped: {}
        }
    }
    
    /// Stop scanning for available devices
    ///
    ///- Parameter resolve: We have succeeded at stopping the scan.
    ///- Parameter reject: Naively unused
    ///
    @objc func stop(_ resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        if let transport = transport, transport.isBluetoothAvailable {
            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.stopScanning()
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
        if let transport = transport {
            resolve(transport.isConnected)
        } else {
            resolve(false)
        }
    }
    
    /// Process a long running task of the Runner type which connects to a scriptrunner endpoint and proxies the
    /// apdus from that HSM to our device while emiting the meaningful events to monitor the progres..
    ///
    ///- Parameter url: Which endpoint to connect to
    ///
    @objc func runner(_ url: String) -> Void {
        if let transport = transport, isConnected {
            /// Try to run a scriptrunner
            self.runnerTask = Runner(
                transport,
                endpoint: URL(string: url)!,
                onEvent: self.emitFromRunner,
                onDone: self.blackHole
            )
        }
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
    ///
    @objc(queue:index:)
    func queue(_ token: String, index: String) -> Void {
        if self.queueTask != nil{
            self.queueTask?.setIndex(index: Int(index) ?? 0)
            self.queueTask?.setToken(token: token)
        }
        else if let transport = transport, isConnected {
            /// Try to run a scriptrunner queue
            self.queueTask = Queue(
                transport,
                token: token,
                index: Int(index) ?? 0,
                onEvent: self.emitFromRunner,
                onDone: self.blackHole
            )
        }
    }


    /// Connect to a device via its uuid
    ///
    ///- Parameter uuid: Unique identifier that represents the Ledger device we want to connect to
    ///- Parameter resolve: UUID of the device we've connected to
    ///- Parameter reject: Unable to establish a connection with the device
    ///
    @objc func connect(_ uuid: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        if let transport = transport {
            if transport.isConnected {
                reject(TransportError.deviceAlreadyConnected.rawValue, "", nil)
            }
            else if !transport.isBluetoothAvailable {
                reject(TransportError.bluetoothRequired.rawValue, "", nil)
            } else {
                let peripheral = PeripheralIdentifier(uuid: UUID(uuidString: uuid)!, name: "")
                DispatchQueue.main.async {
                    transport.connect(toPeripheralID: peripheral) {
                    } success: { PeripheralIdentifier in
                        resolve(uuid)
                    } failure: { e in
                        reject(TransportError.pairingFailed.rawValue, "", nil)
                        if transport.isConnected { /// We may have potentially _connected_ which would break the next scan.
                            transport.disconnect(immediate: false){_ in }
                        }
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
        if let transport = transport {
            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.disconnect(immediate: false, completion: { _ in
                    resolve(true)
                })
            }
        }
        /// Perform some cleanup in case we have some long running tasks going on
        if self.queueTask != nil {
            queueTask?.stop()
            queueTask = nil
        }
        
        if self.runnerTask != nil {
            runnerTask?.stop()
            runnerTask = nil
        }
    }
    
    /// Send a raw APDU message to the connected device,
    ///
    /// - Parameter apdu: Message to be sent to the device, gets validated internally inside the transport
    /// - Parameter resolve: Response from the device apdu exchange
    /// - Parameter reject: Failed to perform the exchange for a variety of reasons
    ///
    @objc func exchange(_ apdu: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        if let transport = transport {
            if !transport.isConnected {
                reject(TransportError.deviceDisconnected.rawValue, "", nil)
            } else {
                DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                    transport.exchange(apdu: APDU(raw: apdu)) { result in
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
