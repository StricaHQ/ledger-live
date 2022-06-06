//
//  Runner.swift
//  hw-transport-react-native-ble
//
//  Created by Juan on 28/5/22.
//

import Foundation
import Starscream
import BleTransport

class Runner: NSObject  {
    var transport : BleTransport
    var endpoint : URL
    
    var onEmit: ((Action, ExtraData?)->Void)?
    var onDone: ((String)->Void)?
    
    var isRunning: Bool = false
    var isUserBlocked: Bool = false
    var isInBulkMode: Bool = false
    var socket: WebSocket?
    
    var HSMNonce: Int = 0               /// HSM uses this nonce to know which frame we are replying to
    var APDUMaxCount: Int = 0
    var APDUQueue: [APDU] = []
    var lastBLEResponse: String = ""
    
    public func setURL(_ url : URL) {
        self.endpoint = url
    }
    
    public init (
        _ transport : BleTransport,
        endpoint : URL,
        onEvent: @escaping ((Action, ExtraData?)->Void),
        onDone: ((String)->Void)?
    ) {
        self.transport = transport
        self.endpoint = endpoint
        self.isRunning = true
        self.onEmit = onEvent
        self.onDone = onDone
        
        super.init()
        self.startScriptRunner()
    }
    
    /// Based on the apdu in/out we can infer some events that we need to emit up to javascript. Not all exchanges need an event.
    private func maybeEmitEvent(_ apdu : String, fromHSM: Bool = true) {
        if fromHSM && apdu.starts(with: "e051") {
            self.isUserBlocked = true
            self.onEmit!(Action.permissionRequested, nil)
        } else if !fromHSM && self.isUserBlocked {
            self.isUserBlocked = false
            if apdu.suffix(4) == "9000" {
                self.onEmit!(Action.permissionGranted, nil)
            } else {
                self.onEmit!(Action.permissionRefused, nil)
            }
        } else if self.isInBulkMode {
            let progress = ((Double(self.APDUMaxCount-self.APDUQueue.count))/Double(self.APDUMaxCount))*100
            self.onEmit!(Action.bulkProgress, ExtraData(progress: progress))
        }
        
    }
    
    private func startScriptRunner() -> Void {
        var request = URLRequest(url: self.endpoint)
        request.timeoutInterval = 20 // No idea if we need this much
        socket = WebSocket(request: request)
        socket!.connect()
        socket!.onEvent = { event in
            switch event {
            case .disconnected(let reason, _):
                self.onDone!(reason)
                break
            case .text(let string):
                
                let data = Data(string.utf8)
                do {
                    if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                        let query = json["query"] as? String;
                        if (query == "bulk") {
                            let rawAPDUs = json["data"] as? [String] ?? []
                            self.APDUQueue = []
                            self.isInBulkMode = true
                            self.APDUMaxCount = rawAPDUs.count // Used for percentage reports
                            
                            for rawAPDU in rawAPDUs {
                                self.APDUQueue.append(APDU(raw: rawAPDU));
                            }
                        } else {
                            self.isInBulkMode = false
                            self.APDUQueue = [APDU(raw: json["data"] as? String ?? "")]
                            self.HSMNonce = json["nonce"] as? Int ?? 0;
                        }
                        self.handleNextAPDU();
                    }
                } catch {
                    print("Failed to load: \(error.localizedDescription)")
                }
                break
            default:
                break
            }
        }
    }
    
    func handleNextAPDU() -> Void {
        if (!self.APDUQueue.isEmpty) {
            let apdu = self.APDUQueue.removeFirst()
            self.maybeEmitEvent((apdu.data.hexEncodedString()))
            self.transport.exchange(apdu: apdu, callback: self.onDeviceResponse)
        }
    }
    
    func onDeviceResponse(_ result : Result<String, BleTransportError>) {
        switch result {
        case .success(let response):
            let status = response.suffix(4)
            let data = response.dropLast(4)
            
            // Figure out what to do next, once again happy path, ignoring any error codes
            if (status == "9000") {
                self.maybeEmitEvent(response, fromHSM: false)
                
                if (self.isInBulkMode) {
                    // Continue writing from our queue.
                    self.handleNextAPDU()
                } else {
                    // Send message back to the script runner
                    // Probably a good idea to move this to an encoded string
                    let response = "{\"nonce\":\(self.HSMNonce),\"response\":\"success\",\"data\":\"\(data)\"}"
                    self.socket!.write(string: response)
                }
            }
        case .failure(let error):
            print(error)
        }
    }
}
