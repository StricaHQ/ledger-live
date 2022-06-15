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
    let BIMWebsocketEndpoint : String = "ws://192.168.0.168:8080"
    
    var transport : BleTransport
    var runner : Runner?
    var onEvent: ((Action, ExtraData?)->Void)?
    var onDone: ((String, String)->Void)?
    var pendingRequest: URLSessionDataTask?

    var token: String = ""                      /// Tokenized representation of our queue
    var index: Int = 0                          /// Current index on the queue
    var item: Item?                             /// Current item we are processing
    var tasks: Tasks = Tasks(tasks: [])         /// Resolved items from the queue token
    
    var stopped: Bool = false
    
    public init (
        _ transport : BleTransport,
        token: String,
        onEvent: @escaping ((Action, ExtraData?)->Void),
        onDone: ((String, String)->Void)?
    ) {
        
        self.transport = transport
        self.token = token
        super.init()

        self.onEvent = onEvent
        self.onDone = onDone
        self.resolveQueueFromToken(true)
    }
    
    /// Exiting the manager or closing an inline installation flow would expect us to cancel any pending installs
    /// When in the LLM main thread paradigm this is easy since the tasks are handled in the same thread as the UI
    /// but here we need to communicate our intent of killing the long running task. This is probably overkill but hey.
    public func stop() {
        self.stopped = true
        token = ""
        index = 0
        item = nil
        tasks = Tasks(tasks: [])
        runner?.stop()
        pendingRequest?.cancel()
    }
    
    /// Given a token string, ask backend for the actual queue we are processing. We could technically send the
    /// queue directly but this was deemed like a good compromise. In any case, it means we resolve the data to
    /// be able to notify the UI of our progress as it unfolds.
    private func resolveQueueFromToken(_ autoStart: Bool) {
        let url = URL(string: "http://192.168.0.168")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = self.token.data(using: .utf8)
        let session = URLSession.shared
        
        if let task = self.pendingRequest {
            task.cancel()
        }

        self.pendingRequest = session.dataTask(with: request) { (data, response, error) in
            if let jsonData = data {
                do {
                    let tasks: Tasks = try JSONDecoder().decode(Tasks.self, from: jsonData)
                    self.tasks = tasks
                    print(tasks)
                    if autoStart {
                        self.startRunner()
                    }
                } catch {
                    print(error)
                }
            }
        }

        self.pendingRequest!.resume()
    }
    
    ///
    /// setToken
    /// After initialization of a Queue we can update the token an essentially start a new Queue if there's nothing
    /// ongoing, or replace the Queue with a new set of actions. This works well because the new queue also
    /// includes the ongoing task (if any) and the current item information used for events is cached in self.item
    /// - Parameter token: Tokenized representation of our queue
    public func setToken(token: String) {
        self.token = token
        self.index = 0
        self.resolveQueueFromToken(self.runner == nil)
    }
    
    ///
    ///startRunner
    ///Launch the next Runner and start emitting the events used by the UI
    private func startRunner() -> Void {
        self.item = self.tasks.tasks[self.index]
        if let item = self.item {
            EventEmitter.sharedInstance.dispatch(
                event: Event.task,
                type: "runStart",
                data: ExtraData(name: item.id, type: item.operation)
            )

            self.runner = Runner(
                transport,
                endpoint: URL(string: BIMWebsocketEndpoint)!,
                onEvent: self.onEventWrapper,
                onDone: self.onDoneWrapper,
                withInitialMessage: "{\"token\":\"\(self.token)\",\"index\":\(self.index)}"
            )
        } /// What if we don't have the item here?
    }
    
    ///
    ///onEventWrapper
    ///The Wrapper is needed to alter the emitted event from a regular runner in case we want to use runners ourside of
    ///a Queue context. We are essentially introducing the application name and operation into the event since that's
    ///expected from the UI as part of the multi item logic.
    ///
    ///- Parameter type: 99% of the time it would be a progress update but, technically, we could see an allow manager flow
    ///- Parameter withData: Event information to send
    private func onEventWrapper(_ type: Action, withData: ExtraData?) -> Void {
        if let item = self.item {
            var wrappedData = withData ?? ExtraData()
            wrappedData.name = item.id
            wrappedData.type = item.operation

            EventEmitter.sharedInstance.dispatch(
                event: Event.task,
                type: "runProgress",
                data: wrappedData
            )
        }
    }
    
    ///
    ///onDoneWrapper
    ///
    ///- Parameter disconnectReason : Not sure what I used this for
    ///- Parameter doneMessage : Last message received from the WS before closing a connection, it can mark that we
    ///                          are still processing a queue or that we are done, allowing us to react to it.
    private func onDoneWrapper (disconnectReason: String, doneMessage : String) -> Void {
        if let item = self.item {
            EventEmitter.sharedInstance.dispatch(
                event: Event.task,
                type: "runSuccess",
                data: ExtraData(name: item.id, type: item.operation)
            )
            if self.stopped { return }

            if (doneMessage == "CONTINUE") {
                self.index += 1
                self.startRunner()
            } else {
                self.runner = nil
                self.onDone!(disconnectReason, doneMessage) /// TODO, or maybe not ok?
            }
        }
    }
}
