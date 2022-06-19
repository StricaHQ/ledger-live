import { useMemo, useRef, useState, useEffect } from "react";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import type { State } from "./types";
import { withDevice } from "../hw/deviceAccess";
import BIM from "../api/BIM";
import { getNextAppOp } from "./logic";

const useBackgroundInstallSubject = (
  deviceId: string | undefined,
  state: State,
  onEventDispatch: (event) => void
): any => {
  // Whenever the queue changes, we need get a new token, but ONLY if this queue
  // change is because we are adding a new item and not because an item was consumed.
  const observable: any = useRef(new Subject().pipe(map(onEventDispatch)));
  const nextAppOp = useMemo(() => getNextAppOp(state), [state]);
  const [transport, setTransport] = useState<any>();
  const [token, setToken] = useState<string>();
  const lastSeenQueueSize = useRef(0);
  const { installQueue, uninstallQueue, updateAllQueue } = state;
  const queueSize =
    installQueue.length + uninstallQueue.length + updateAllQueue.length;

  const shouldStartNewJob = useMemo(
    () => deviceId && !transport && token && queueSize,
    [deviceId, queueSize, token, transport]
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

  useEffect(() => {
    async function startJob(deviceId: string) {
      await withDevice(deviceId)((transport) => {
        setTransport(transport);
        return observable.current;
      })
        .toPromise()
        .then((_) => {
          observable.current = new Subject().pipe(map(onEventDispatch));
        })
        .catch((error) => {
          onEventDispatch({
            type: "runError",
            appOp: {},
            error,
          });
        })
        .finally(() => {
          setTransport(undefined);
        });
    }

    if (shouldStartNewJob && deviceId) {
      startJob(deviceId);
    }
  }, [deviceId, shouldStartNewJob, onEventDispatch, nextAppOp]);

  useEffect(() => {
    if (!token || !transport) return;
    transport.constructor.queue(observable.current, token);
  }, [token, transport]);

  return !!deviceId;
};

export default useBackgroundInstallSubject;
