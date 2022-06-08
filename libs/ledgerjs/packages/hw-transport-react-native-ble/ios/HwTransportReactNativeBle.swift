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
        self.transport = BleTransport(configuration: nil, debugMode: false)
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
    
    
    
    /// Listen for devices. We will emi
    ///
    @objc func listen() -> Void {
        if let transport = transport, transport.isBluetoothAvailable {
            /// To allow for subsequent scans
            self.seenDevicesByUUID = [:]
            self.lastSeenSize = 0

            /// Notify the observer about starting the scan
            EventEmitter.sharedInstance.dispatch(
                event: Event.status,
                type: Status.startScanning.rawValue,
                data: nil
            )
            
            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.scan { [weak self] discoveries in
                    if discoveries.count != self!.lastSeenSize {
                        self?.lastSeenSize = discoveries.count
                        
                        /// Found devices are handled via events since we need more than one call
                        /// We can then polyfill the model and other information based on the service ID
                        /// of the BLE stack
                        discoveries.forEach{
                            self?.seenDevicesByUUID[$0.peripheral.uuid.uuidString] = $0.peripheral

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
                } stopped: {
                    /// Notify the observer about stop the scan
                    EventEmitter.sharedInstance.dispatch(
                        event: Event.status,
                        type: Status.stopScanning.rawValue,
                        data: nil
                    )
                }
            }
        }
    }
    
    /// Stop scanning for devices
    ///
    @objc func stop() -> Void {
        if let transport = transport, transport.isBluetoothAvailable {
            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.stopScanning()
                self.seenDevicesByUUID = [:]
                self.lastSeenSize = 0
            }
        }
    }
    
    /// Used to determine if a device connection is still valid since changing apps invalidates it, if all goes according
    /// to the specs we should disconnect as soon as we finish an interaction, so it's important to check whether
    /// the connection still exists before trying to interact. We also do this, probably redundantly, in the exchange func
    ///
    @objc func isConnected(_ callback: @escaping RCTResponseSenderBlock) -> Void {
        if let transport = transport {
            callback([NSNull(), transport.isConnected])
        } else {
            callback([NSNull(), false])
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
    ///- Parameter uuid:     Unique identifier that represents the Ledger device we want to connect to
    ///- Parameter callback: Node style callback with a _maybe_ leading error
    ///
    @objc func connect(_ uuid: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        if let transport = transport {
            let wrappedCallback = singleUseCallback(callback)
            if transport.isConnected {
                wrappedCallback([ "device already connected"])
            }

            let peripheral = PeripheralIdentifier(uuid: UUID(uuidString: uuid)!, name: "")
            DispatchQueue.main.async {
                transport.connect(toPeripheralID: peripheral) { [self] in
                    isConnected = false
                } success: { [self] PeripheralIdentifier in
                    isConnected = true
                    wrappedCallback([NSNull(), true])
                } failure: { [self] e in
                    isConnected = false
                    wrappedCallback([String(describing: e), false])
                }
            }
        }
    }
    
    /// Disconnect from a device and clean up after ourselves. This is particularly important since from a Live
    /// point of view we will be disconnecting actively whenever an exchange completes, it's the perfcect spot
    /// to remove any lingering tasks and flags. We don't check whether we are connected before because the
    /// state may not be visible
    ///
    /// - Parameter callback: Node style callback with a _maybe_ leading error
    ///
    @objc func disconnect(_ callback: @escaping RCTResponseSenderBlock) -> Void {
        if let transport = transport {
            let wrappedCallback = singleUseCallback(callback)
            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.disconnect(immediate: true, completion: { _ in
                    wrappedCallback([NSNull(), true])
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
    /// - Parameter callback: Node style callback with a _maybe_ leading error
    ///
    @objc func exchange(_ apdu: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        if let transport = transport {
            let wrappedCallback = singleUseCallback(callback)
            if !transport.isConnected {
                wrappedCallback([ "device-disconnected"])
            }

            DispatchQueue.main.async { /// Seems like I'm going to have to do this all the time
                transport.exchange(apdu: APDU(raw: apdu)) { result in
                    switch result {
                    case .success(let response):
                        wrappedCallback([NSNull(), response])
                    case .failure(let error):
                        switch error {
                        case .writeError(let description):
                            wrappedCallback([ "write error \(String(describing:description))"])
                        case .pendingActionOnDevice:
                            wrappedCallback([ "user-pending-action"])
                        default:
                            wrappedCallback([ "another action"])
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
    
    /// With the introduction of a hard crash on rn side if the callback was invoked multiple times we now
    /// need to wrap those callbacks to prevent it. The internal flag acts like a killswitch if it's triggered more than once
    ///
    ///- Parameter callback: Original callback that we are wrapping, following the rn pattern
    ///
    func singleUseCallback(_ callback: @escaping RCTResponseSenderBlock) -> RCTResponseSenderBlock {
        var used: Bool = false
        return { (parameters) -> Void in
            if !used {
                used = true
                return callback(parameters)
            }
        }
    }
}
