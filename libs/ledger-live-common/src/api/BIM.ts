import network from "../network";
import { getEnv } from "../env";
import type { State } from "../apps/types";
import { version as liveCommonVersion } from "../../package.json";

const getBaseApiUrl = () => getEnv("API_BIM");

/**
 * Big bald disclaimer about all this. The token is currently a base64
 * representation of the queue, nothing else, but eventually we will have
 * a smarter and encoded token blackbox. I mention this in case someone
 * is reading and wondering why on earth are we doing this.
 */
type Item = {
  operation: "install" | "uninstall";
  id: number;
  targetId: string | number;
  liveCommonVersion?: string;
};
type Queue = Array<Item>;

function buildQueueFromState(state: State): Array<Item> {
  const queue: Array<Item> = [];
  const { targetId } = state.deviceInfo;

  Object.entries({
    uninstall: state.uninstallQueue,
    install: state.installQueue,
  }).forEach(([operation, items]: any) => {
    // Install | Uninstall
    items.forEach((appName) => {
      if (appName in state.appByName) {
        const app = state.appByName[appName];
        queue.push({
          id: app.id,
          operation,
          targetId,
          liveCommonVersion,
        });
      }
    });
  });
  return queue;
}

async function getTokenFromQueue(queue: Queue): Promise<string> {
  const { data } = await network({
    method: "PUT",
    url: `${getBaseApiUrl()}/queue`,
    data: { tasks: queue },
  });

  return data;
}

async function getQueueFromToken(token: string): Promise<Queue> {
  const { data } = await network({
    method: "POST",
    url: "http://192.168.0.168:8888/",
    headers: {
      "Content-Type": "text/plain",
    },
    data: token,
  });
  return data;
}

const API = {
  getTokenFromQueue,
  getQueueFromToken,
  buildQueueFromState,
};

export default API;
