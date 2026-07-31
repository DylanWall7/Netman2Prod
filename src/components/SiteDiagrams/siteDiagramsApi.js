import {
  listNetboxSites,
  useNetworkSearchToken,
} from "../NetworkSearch/deviceOutputsApi";
import { MOCK_SNAPSHOTS, getMockSnapshotDetail } from "./mockData";

const MOCK_DELAY_MS = 400;

function delay(value) {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), MOCK_DELAY_MS),
  );
}

export { listNetboxSites, useNetworkSearchToken };

export async function listSnapshots(siteId) {
  return delay(MOCK_SNAPSHOTS.map((s) => ({ ...s, siteId })));
}

export async function getSnapshot(siteId, snapshotId) {
  return delay(getMockSnapshotDetail(snapshotId));
}
