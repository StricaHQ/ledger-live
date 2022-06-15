import { useRef, useEffect, useMemo } from "react";
import { Subject, from } from "rxjs";
import type { State } from "./types";
import { withDevice } from "../hw/deviceAccess";
import BIM from "../api/BIM";

const useBackgroundInstallSubject = (
  deviceId: string | undefined,
  state: State
): any => {
  const observable = useMemo(() => new Subject(), []);
  const transportRef = useRef<any>();
  const { installQueue, uninstallQueue } = state;

  useEffect(() => {
    let invalidated = false;

    (async function startOrUpdateQueue() {
      const queue = BIM.buildQueueFromState(state);
      const token = await BIM.getTokenFromQueue(queue);
      if (!deviceId || !queue.length) return;
      if (!transportRef.current) {
        // This seems terrible, but how can I get a hold of the transport otherwise.
        await withDevice(deviceId)((transport) => {
          transportRef.current = transport;
          return from([]);
        }).toPromise();
      }

      if (invalidated) return;

      // @ts-ignore This is ugly.
      return transportRef.current.constructor.queue(observable, token);
    })();

    return () => {
      invalidated = true;
    };
    // We don't want this to run again when anything in state changes, only when the queue does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, installQueue, observable, uninstallQueue]);

  if (!deviceId) return null;
  return observable;
};

export default useBackgroundInstallSubject;
