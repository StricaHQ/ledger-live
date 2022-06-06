//
//  EventEmitter.swift
//  hw-transport-react-native-ble
//
//  Created by Juana on 27/5/22.
//

import Foundation


enum Event: String, CaseIterable {
    case parent = "BleTransport"
    
    case newDevice = "new-device"
    case status = "status"
    case apdu = "apdu"
    case task = "task"
}

enum Status: String, CaseIterable {
    case startScanning = "start-scanning"
    case stopScanning = "stop-scanning"
    case error = "error"
}

enum Action: String, CaseIterable {
    case permissionRequested = "device-permission-requested"
    case permissionGranted = "device-permission-granted"
    case permissionRefused = "device-permission-refused"
    case bulkProgress = "bulk-progress"
}

/// Event payloads
struct Payload: Codable {
    let event: String
    let type: String
    let data: ExtraData?
}

struct ExtraData: Codable {
    var msg: String?

    /// Device extras
    var uuid: String?
    var name: String?
    var service: String?
    
    /// Bulk action extras
    var progress: Double?
}

class EventEmitter {
    public static var sharedInstance = EventEmitter()
    private var eventEmitter: HwTransportReactNativeBle!
    
    private var isJavaScriptAvailable: Bool = true
    private var isConsumingQueue: Bool = false
    private var queuedEvents:[Payload] = []
    
    /// Throttling optimization feat
    private var pendingEvent : DispatchSourceTimer!
    private var lastEventTime : Double = 0
    private var lastEventType : String = "none"
    private var throttle : Int = 1200 /// Minimum time in ms between events of same type.
    
    private init() {}
    
    func registerEventEmitter(eventEmitter: HwTransportReactNativeBle) {
        self.eventEmitter = eventEmitter
    }
    
    func onAppStateChange(awake: Bool) {
        self.isJavaScriptAvailable = awake
        if awake {
            self.consumeEventQueue()
        }
    }
    
    func dispatch(event: Event, type: String, data: ExtraData?) {
        let newPayload = Payload(event: event.rawValue, type: type, data: data)
        
        if self.queuedEvents.count > 0 {
            let previousLog = self.queuedEvents.last
            if previousLog?.type == newPayload.type
            && previousLog?.event == newPayload.event {
                self.queuedEvents[self.queuedEvents.count-1] = newPayload
                self.consumeEventQueue()
                return
            }
        }
        self.queuedEvents.append(newPayload)
        self.consumeEventQueue()
    }
    
    /// Expected to be able to take care of any background running task that emits events, it is initially conceived to support socket connections
    /// to script runners such as those used for app installations, firmware updates, and queue consumptions through the BIM system. The events
    /// will mostly be consistent throughout all implementations but may need some tweaking.
    private func consumeEventQueue () {
        if !self.isJavaScriptAvailable || self.isConsumingQueue {
            return
        }
        
        self.isConsumingQueue = true /// Lock this regardless of app state
        
        while self.queuedEvents.count > 0 && self.isJavaScriptAvailable {
            let event = self.queuedEvents.removeFirst()
            do {
                let encodedData = try JSONEncoder().encode(event)
                let payload = String(data: encodedData, encoding: .utf8)

                let exec: () -> Void = {
                    self.eventEmitter.sendEvent(withName:Event.parent.rawValue, body: payload)
                    self.lastEventType = event.type
                    self.lastEventTime = Date().timeIntervalSince1970
                    
                    if self.pendingEvent != nil {
                        self.pendingEvent.cancel()
                        self.pendingEvent = nil
                    }
                }
                
                /// There's a scheduled event of the same type, replace it with this one
                if (self.pendingEvent != nil && self.lastEventType == event.type) {
                    // We know we can replace this with our event, no need to touch the
                    self.pendingEvent.setEventHandler(handler: exec)
                }
                /// It's too soon to dispatch another event of the same type
                else if (self.lastEventTime + Double(self.throttle)/1000) >= Date().timeIntervalSince1970 &&
                            self.lastEventType == event.type {
                    let offset = Date(timeIntervalSince1970: TimeInterval((self.lastEventTime))).timeIntervalSinceNow
                    let msOffset = Int(offset * 1000) + self.throttle
                    
                    self.pendingEvent = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
                    self.pendingEvent.schedule(deadline: .now() + .milliseconds(msOffset))
                    self.pendingEvent.setEventHandler(handler: exec)
                    self.pendingEvent.resume()
                }
                /// All other cases can safely dispatch the event
                else {
                    exec()
                }
            } catch {
                print(error)
            }
        }
        
        /// Yummy!
        self.isConsumingQueue = false
    }

    lazy var allEvents: [String] = {
        return ["BleTransport"] // All events can be wrapped through this channel.
    }()
}
