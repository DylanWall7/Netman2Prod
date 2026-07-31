export const MOCK_SITE = { id: "mock-site-1", name: "Demo Site (Fake)" };

const BASE_DEVICES = [
  {
    id: "rtr-core",
    name: "rtr-core",
    vendor: "juniper",
    model: "SRX345",
    role: "router",
    location: "Admin",
    ip: "10.10.0.1",
    version: "21.4R3",
    uptimeSeconds: 5184000,
  },
  {
    id: "swd1",
    name: "swd1",
    vendor: "juniper",
    model: "EX4400-48P",
    role: "distribution",
    location: "Admin",
    ip: "10.10.0.2",
    version: "22.4R1",
    uptimeSeconds: 4838400,
  },
  {
    id: "swd2",
    name: "swd2",
    vendor: "juniper",
    model: "EX4400-48P",
    role: "distribution",
    location: "Yard",
    ip: "10.10.0.3",
    version: "22.4R1",
    uptimeSeconds: 4838400,
  },
  {
    id: "agg1",
    name: "agg1",
    vendor: "cisco",
    model: "Catalyst 9200",
    role: "aggregation",
    location: "Yard",
    ip: "10.10.0.4",
    version: "17.9.4",
    uptimeSeconds: 3628800,
  },
  {
    id: "agg2",
    name: "agg2",
    vendor: "cisco",
    model: "Catalyst 9200",
    role: "aggregation",
    location: "Warehouse",
    ip: "10.10.0.5",
    version: "17.9.4",
    uptimeSeconds: 3628800,
  },
  {
    id: "nano-wh-01",
    name: "nano-wh-01",
    vendor: "ubiquiti",
    model: "NanoBeam 5AC",
    role: "wireless_bridge",
    location: "Warehouse",
    ip: "10.10.0.6",
    version: "8.7.11",
    uptimeSeconds: 2678400,
  },
];

for (let i = 1; i <= 5; i++) {
  BASE_DEVICES.push({
    id: `acc-admin-0${i}`,
    name: `acc-admin-0${i}`,
    vendor: "aruba",
    model: "2930F",
    role: "access",
    location: "Admin",
    ip: `10.10.1.${i}`,
    version: "16.10.0024",
    uptimeSeconds: 1814400 + i * 3600,
  });
}

for (let i = 1; i <= 5; i++) {
  BASE_DEVICES.push({
    id: `acc-yard-0${i}`,
    name: `acc-yard-0${i}`,
    vendor: "cisco",
    model: "Catalyst 9300",
    role: "access",
    location: "Yard",
    ip: `10.10.2.${i}`,
    version: "17.9.4",
    uptimeSeconds: 1728000 + i * 3600,
  });
}

for (let i = 1; i <= 3; i++) {
  BASE_DEVICES.push({
    id: `acc-wh-0${i}`,
    name: `acc-wh-0${i}`,
    vendor: "ubiquiti",
    model: "UniFi USW-24",
    role: "access",
    location: "Warehouse",
    ip: `10.10.3.${i}`,
    version: "7.0.55",
    uptimeSeconds: 1296000 + i * 3600,
  });
}

BASE_DEVICES.push({
  id: "acc-wh-04",
  name: "acc-wh-04",
  vendor: "ubiquiti",
  model: "UniFi USW-Lite-8",
  role: "access",
  location: "Warehouse",
  ip: "10.10.3.4",
  version: "7.0.55",
  uptimeSeconds: 1296000,
});

const BASE_LINKS = [
  {
    id: "lnk-core-swd1",
    source: { deviceId: "rtr-core", port: "ge-0/0/0" },
    target: { deviceId: "swd1", port: "ge-0/0/0" },
    medium: "fiber",
    discoveredVia: "lldp",
  },
  {
    id: "lnk-core-swd2",
    source: { deviceId: "rtr-core", port: "ge-0/0/1" },
    target: { deviceId: "swd2", port: "ge-0/0/0" },
    medium: "fiber",
    discoveredVia: "lldp",
  },
  {
    id: "lnk-swd1-agg2",
    source: { deviceId: "swd1", port: "ge-0/0/10" },
    target: { deviceId: "agg2", port: "GigabitEthernet1/0/1" },
    medium: "fiber",
    discoveredVia: "lldp",
  },
  {
    id: "lnk-swd2-agg1",
    source: { deviceId: "swd2", port: "ge-0/0/10" },
    target: { deviceId: "agg1", port: "GigabitEthernet1/0/1" },
    medium: "fiber",
    discoveredVia: "lldp",
  },
  {
    id: "lnk-agg2-nano",
    source: { deviceId: "agg2", port: "GigabitEthernet1/0/5" },
    target: { deviceId: "nano-wh-01", port: "eth0" },
    medium: "fiber",
    discoveredVia: "lldp",
  },
  {
    id: "lnk-nano-accwh04",
    source: { deviceId: "nano-wh-01", port: "eth1" },
    target: { deviceId: "acc-wh-04", port: "eth0" },
    medium: "wireless",
    discoveredVia: "wireless",
  },
];

for (let i = 1; i <= 5; i++) {
  BASE_LINKS.push({
    id: `lnk-swd1-accadmin0${i}`,
    source: { deviceId: "swd1", port: `ge-0/0/${i}` },
    target: { deviceId: `acc-admin-0${i}`, port: "1/1/1" },
    medium: "copper",
    discoveredVia: "lldp",
  });
}

for (let i = 1; i <= 5; i++) {
  BASE_LINKS.push({
    id: `lnk-agg1-accyard0${i}`,
    source: { deviceId: "agg1", port: `GigabitEthernet1/0/${i + 1}` },
    target: { deviceId: `acc-yard-0${i}`, port: "GigabitEthernet1/0/1" },
    medium: "copper",
    discoveredVia: "lldp",
  });
}

for (let i = 1; i <= 3; i++) {
  BASE_LINKS.push({
    id: `lnk-agg2-accwh0${i}`,
    source: { deviceId: "agg2", port: `GigabitEthernet1/0/${i + 1}` },
    target: { deviceId: `acc-wh-0${i}`, port: "1" },
    medium: "copper",
    discoveredVia: "lldp",
  });
}

const SNAPSHOT_COUNT = 10;
const DEGRADED_SNAPSHOT_COUNT = 2; // oldest N snapshots show an outage
const HOURS_BETWEEN_SNAPSHOTS = 6;
const LATEST_SNAPSHOT_TIME = new Date("2026-07-29T14:00:00Z").getTime();

export const MOCK_SNAPSHOTS = Array.from({ length: SNAPSHOT_COUNT }, (_, i) => ({
  id: `snap-${String(i + 1).padStart(2, "0")}`,
  siteId: MOCK_SITE.id,
  takenAt: new Date(
    LATEST_SNAPSHOT_TIME - i * HOURS_BETWEEN_SNAPSHOTS * 3600 * 1000,
  ).toISOString(),
}));

function buildDetail(isDegraded) {
  const nodes = BASE_DEVICES.map((d) => ({
    ...d,
    status:
      isDegraded && d.id === "acc-wh-02" ? "offline" : "online",
  }));
  const links = BASE_LINKS.map((l) => ({
    ...l,
    status:
      isDegraded && l.id === "lnk-agg2-accwh02" ? "down" : "up",
  }));
  return { nodes, links };
}

const HEALTHY_DETAIL = buildDetail(false);
const DEGRADED_DETAIL = buildDetail(true);

export function getMockSnapshotDetail(snapshotId) {
  const index = MOCK_SNAPSHOTS.findIndex((s) => s.id === snapshotId);
  const isDegraded = index >= SNAPSHOT_COUNT - DEGRADED_SNAPSHOT_COUNT;
  return isDegraded ? DEGRADED_DETAIL : HEALTHY_DETAIL;
}
