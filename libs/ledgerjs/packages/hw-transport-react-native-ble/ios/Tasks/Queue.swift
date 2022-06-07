//
//  Queue.swift
//  hw-transport-react-native-ble
//
//  Created by Juan on 07/6/22.
//

import Foundation
import Starscream
import BleTransport

/// A QueueRunner is a convenience wrapper to be able to consume multiple script runners through the BIM
/// interface. This interface allows a consumer to go over multiple app operations (installs/uninstalls) without
/// needing to resolve the scriptrunner url for each one of them (we have it already on Live side, ok, fair enough)
/// while at the same time breaking the dependency with the JS thread, this is the highlight, yes.
class Queue: NSObject  {
    var transport : BleTransport
    var runner : Runner?
    var onEvent: ((Action, ExtraData?)->Void)?
    var onDone: ((String, String)->Void)?
    var token: String = ""
    var index: Int = 0
    
    var stopped: Bool = false
    
    public init (
        _ transport : BleTransport,
        token: String,
        index: Int,
        onEvent: @escaping ((Action, ExtraData?)->Void),
        onDone: ((String, String)->Void)?
    ) {
        
        self.transport = transport
        self.token = token
        self.index = index
        super.init()

        self.onEvent = onEvent
        self.onDone = onDone
        self.startRunner()
    }
    
    public func stop() {
        self.stopped = true
        runner?.stop()
    }
    
    public func setToken(token: String) {
        self.token = token
    }
    
    public func setIndex(index: Int) {
        self.index = index
    }
    
    private func startRunner() -> Void {
        self.runner = Runner(
            transport,
            endpoint: URL(string: "ws://192.168.0.168:8080")!, /// This would be the BIM endpoint eventually
            onEvent: self.onEventWrapper,
            onDone: self.onDoneWrapper,
            withInitialMessage: "{\"token\":\"\(self.token)\",\"index\":\(self.index)}"
        )
        self.index += 1
    }
    
    private func onEventWrapper(_ type: Action, withData: ExtraData?) -> Void {
        /// Modify the message with perhaps a global queue, on the JS side we should polyfill the info missing
        /// such as the app name and whatnot.
        var wrappedData = withData ?? ExtraData()
        wrappedData.queueItem = self.index - 1

        EventEmitter.sharedInstance.dispatch(
            event: Event.task,
            type: type.rawValue,
            data: wrappedData
        )
    }
    
    private func onDoneWrapper (disconnectReason: String, doneMessage : String) -> Void {
        if self.stopped {
            return /// Killswitch
        }

        if (doneMessage == "CONTINUE") {
            self.startRunner()
        } else {
            self.onDone!(disconnectReason, doneMessage) // TODO, or maybe not ok?
        }
    }
}
