import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import type { State } from "./types";
import { withDevice } from "../hw/deviceAccess";
import BIM from "../api/BIM";

const useBackgroundInstallSubject = (
  deviceId: string | undefined,
  state: State,
  onEventDispatch: (event) => void
): any => {
  // Whenever the queue changes, we need get a new token, but ONLY if this queue
  // change is because we are adding a new item and not because an item was consumed.
  const observable: any = useRef();
  const [transport, setTransport] = useState<any>();
  const [pendingTransport, setPendingTransport] = useState<boolean>(false);
  const [token, setToken] = useState<string>();
  const lastSeenQueueSize = useRef(0);
  const { installQueue, uninstallQueue, updateAllQueue } = state;
  const queueSize =
    installQueue.length + uninstallQueue.length + updateAllQueue.length;

  const shouldStartNewJob = useMemo(
    () => deviceId && !transport && !pendingTransport && token && queueSize,
    [deviceId, pendingTransport, queueSize, token, transport]
  );

  useEffect(() => {
    async function fetchToken() {
      const queue = BIM.buildQueueFromState(state);
      const token = await BIM.getTokenFromQueue(queue);
      setToken(token);
    }

    if (queueSize > lastSeenQueueSize.current) {
      // If the queue is larger, our token is no longer valid and we need a new one.
      fetchToken();
    }
    // Always update the last seen
    lastSeenQueueSize.current = queueSize;
  }, [queueSize, setToken, state]);

  const cleanUp = useCallback(()=>{
    setPendingTransport(false);
    setToken(undefined);
    setTransport(undefined);
  }, []);

  const startNewJob = useCallback(() => {
    let sub;
    if (deviceId) {
      setPendingTransport(true);
      sub = withDevice(deviceId)((transport) => {
        observable.current = new Subject();
        setTransport(transport);
        setPendingTransport(false);
        return observable.current;
      }).subscribe({
        next: onEventDispatch,
        error: error => {
          cleanUp();
          onEventDispatch({
            type: "runError",
            appOp: {},
            error,
          });
        },
        complete: cleanUp,
      });
    }

    return () => {
      sub?.unsubscribe()
    }
  }, []);

  useEffect(() => {
    if (shouldStartNewJob) startNewJob()
  }, [deviceId, shouldStartNewJob, onEventDispatch]);

  useEffect(() => {
    if (!token || !transport) return;
    transport.constructor.queue(observable.current, token);
  }, [token, transport]);

  return !!deviceId;
};

export default useBackgroundInstallSubject;
