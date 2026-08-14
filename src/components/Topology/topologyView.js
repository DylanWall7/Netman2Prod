import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  NodeToolbar,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// helpers

const normMac = (mac) => (mac ?? "").toLowerCase().replace(/[^0-9a-f]/g, "");

const PortLabelsCtx = React.createContext(false);

// Ubiquiti OUI prefixes — Nanobeams use CDP (not LLDP), so neighbor_system_name is empty
// but neighbor_mac still has a Ubiquiti OUI from the CDP frame
const UBIQUITI_OUIS = new Set([
  "24a43c",
  "788a20",
  "dc9fdb",
  "18e829",
  "44d9e7",
  "70a741",
  "e063da",
  "802aa8",
  "f09fc2",
  "b4fbe4",
  "68722d",
  "00272d",
  "04180d",
]);

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function resolvePortFromPortDetails(detail, localPort) {
  const members = detail?.custom?.vc_members ?? [];
  for (const member of members) {
    for (const pic of member.pics ?? []) {
      for (const port of pic.ports ?? []) {
        if (port.port_id === localPort && port.neighbor_port_desc) {
          return port.neighbor_port_desc;
        }
      }
    }
  }
  return null;
}

// Resolve the local port on `detail`'s device by looking for a vc_members port
// whose neighbor_system_name (stripping _nodeN suffix) matches `neighborName`.
// Used as a fallback when the peer reports a virtual/RETH MAC not in deviceByMac.
function resolvePortByNeighborName(detail, neighborName) {
  const stripped = (neighborName ?? "").replace(/_node\d+$/i, "").toLowerCase();
  if (!stripped) return null;
  for (const member of detail?.custom?.vc_members ?? []) {
    for (const pic of member.pics ?? []) {
      for (const port of pic.ports ?? []) {
        const sn = (port.neighbor_system_name ?? "")
          .replace(/_node\d+$/i, "")
          .toLowerCase();
        if (sn && sn === stripped) return port.port_id;
      }
    }
  }
  return null;
}

function portSortKey(port) {
  return (
    (port ?? "")
      .match(/\d+/g)
      ?.map((n) => n.padStart(6, "0"))
      .join("/") ??
    port ??
    ""
  );
}

// link color - reads media_type straight from the port data, no guessing

function getPortMediaType(detail, portId) {
  for (const member of detail?.custom?.vc_members ?? []) {
    for (const pic of member.pics ?? []) {
      for (const port of pic.ports ?? []) {
        if (port.port_id === portId && port.media_type) return port.media_type;
      }
    }
  }
  return null;
}

function getLinkColor(mediaType, linkUp) {
  if (!linkUp) return "#6B7280";
  if (mediaType === "fiber") return "#f59e0b"; // amber = fiber
  return "#3b82f6"; // blue = copper (or unknown)
}

// layout constants

const NODE_W = 190;
const NODE_H = 150;
const H_GAP = 60;
const V_GAP = 120;

function treeLayout(
  deviceIds,
  rootIds,
  adjacency,
  portOnParent,
  nodeWidths = {},
  preRanks = null,
  hGap = H_GAP,
  vGap = V_GAP,
) {
  const rank = {};
  if (preRanks) {
    // use the caller's pre-computed ranks directly — no BFS needed
    deviceIds.forEach((id) => {
      rank[id] = preRanks[id] ?? 0;
    });
  } else {
    const queue = [...rootIds];
    rootIds.forEach((id) => (rank[id] = 0));
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      (adjacency[cur] ?? []).forEach((nb) => {
        if (rank[nb] === undefined) {
          rank[nb] = rank[cur] + 1;
          queue.push(nb);
        }
      });
    }
    deviceIds.forEach((id) => {
      if (rank[id] === undefined) rank[id] = 0;
    });
  }

  const rows = {};
  deviceIds.forEach((id) => {
    const r = rank[id];
    if (!rows[r]) rows[r] = [];
    rows[r].push(id);
  });

  Object.values(rows).forEach((rowIds) => {
    rowIds.sort((a, b) => {
      const pa = portSortKey(portOnParent[a] ?? "");
      const pb = portSortKey(portOnParent[b] ?? "");
      if (pa !== pb) return pa < pb ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  });

  const nodeW = (id) => nodeWidths[id] ?? NODE_W;

  const rowTotalW = (ids) =>
    ids.reduce((sum, id) => sum + nodeW(id), 0) +
    Math.max(0, ids.length - 1) * hGap;

  const maxRowW = Math.max(...Object.values(rows).map(rowTotalW));

  const positions = {};
  Object.entries(rows).forEach(([row, ids]) => {
    const y = Number(row) * (NODE_H + vGap);
    const rowW = rowTotalW(ids);
    let x = (maxRowW - rowW) / 2;
    ids.forEach((id) => {
      positions[id] = { x, y };
      x += nodeW(id) + hGap;
    });
  });

  return { positions, rank };
}

// collapse / expand helpers

function countDescendants(nodeId, childrenMap) {
  let count = 0;
  const q = [...(childrenMap[nodeId] ?? [])];
  let h = 0;
  while (h < q.length) {
    const cur = q[h++];
    count++;
    (childrenMap[cur] ?? []).forEach((c) => q.push(c));
  }
  return count;
}

function computeVisible(allNodes, allEdges, collapsedIds, childrenMap) {
  // walk every collapsed node and collect all descendants to hide
  const hidden = new Set();
  collapsedIds.forEach((cid) => {
    const q = [...(childrenMap[cid] ?? [])];
    let h = 0;
    while (h < q.length) {
      const cur = q[h++];
      if (!hidden.has(cur)) {
        hidden.add(cur);
        (childrenMap[cur] ?? []).forEach((c) => q.push(c));
      }
    }
  });

  const visibleNodes = allNodes
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      const hasChildren = (childrenMap[n.id] ?? []).length > 0;
      const isCollapsed = collapsedIds.has(n.id);
      const hiddenCount = isCollapsed ? countDescendants(n.id, childrenMap) : 0;
      return {
        ...n,
        data: { ...n.data, hasChildren, isCollapsed, hiddenCount },
      };
    });

  const visibleEdges = allEdges.filter(
    (e) => !hidden.has(e.source) && !hidden.has(e.target),
  );

  return { visibleNodes, visibleEdges };
}

// edge component - shows upstream/downstream port info on hover

function HoverEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}) {
  const { screenToFlowPosition } = useReactFlow();
  const showPortLabels = React.useContext(PortLabelsCtx);
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState(null);

  const [path, lx, ly] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const activeStyle = hovered
    ? {
        ...style,
        strokeWidth: 3,
        filter: `drop-shadow(0 0 5px ${style?.stroke ?? "#3b82f6"})`,
      }
    : style;

  // use mouse-tracked flow position when available, fall back to edge midpoint
  const tx = tipPos?.x ?? lx;
  const ty = tipPos?.y ?? ly;

  return (
    <>
      <BaseEdge id={id} path={path} style={activeStyle} markerEnd={markerEnd} />
      <path
        d={path}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setTipPos(null);
        }}
        onMouseMove={(e) =>
          setTipPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        }
      />
      <EdgeLabelRenderer>
        {showPortLabels && (
          <>
            {/* upstream port — near source end */}
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%, 4px) translate(${sourceX}px, ${sourceY}px)`,
                pointerEvents: "none",
              }}
              className="text-[9px] font-mono text-blue-300 bg-gray-950/80 px-1 rounded"
            >
              {data.parentPort}
            </div>
            {/* downstream port — near target end */}
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%, -100%) translate(${targetX}px, ${targetY - 4}px)`,
                pointerEvents: "none",
              }}
              className="text-[9px] font-mono text-emerald-300 bg-gray-950/80 px-1 rounded"
            >
              {data.childPort}
            </div>
          </>
        )}
        {hovered && (
          <div
            style={{
              position: "absolute",
              transform: `translate(${tx + 8}px, ${ty - 20}px)`,
              pointerEvents: "none",
              zIndex: 1000,
            }}
            className="bg-gray-950 border border-gray-600 text-[11px] font-mono px-3 py-2 rounded shadow-xl space-y-1"
          >
            <div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide">
                upstream
              </div>
              <div className="text-blue-300">
                {data.parentName}:{" "}
                <span className="text-white font-semibold">
                  {data.parentPort}
                </span>
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide">
                downstream
              </div>
              <div className="text-emerald-300">
                {data.childName}:{" "}
                <span className="text-white font-semibold">
                  {data.childPort}
                </span>
              </div>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

// Wireless (Nanobeam) edge — dashed cyan, tooltip says "Wireless Bridge"
function WirelessEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState(null);

  const style = { stroke: "#06b6d4", strokeWidth: 2, strokeDasharray: "8 4" };
  const activeStyle = hovered
    ? { ...style, strokeWidth: 3, filter: "drop-shadow(0 0 6px #06b6d4)" }
    : style;

  const [path, lx, ly] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const tx = tipPos?.x ?? lx;
  const ty = tipPos?.y ?? ly;

  return (
    <>
      <BaseEdge id={id} path={path} style={activeStyle} markerEnd={markerEnd} />
      <path
        d={path}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setTipPos(null);
        }}
        onMouseMove={(e) =>
          setTipPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        }
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(${tx + 8}px, ${ty - 20}px)`,
              pointerEvents: "none",
              zIndex: 1000,
            }}
            className="bg-gray-950 border border-cyan-700 text-[11px] font-mono px-3 py-2 rounded shadow-xl space-y-1"
          >
            <div className="text-cyan-400 font-semibold text-[10px] uppercase tracking-wide">
              Wireless Bridge
            </div>
            <div className="text-gray-400 text-[10px]">Ubiquiti Nanobeam</div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { hoverEdge: HoverEdge, wirelessEdge: WirelessEdge };

// node card - red = router (RWA), purple = distribution (SWD), orange = aggregation (AGG), blue = access switch

function DeviceNode({
  data,
  selected,
  id,
  accentColor = "#3b82f6",
  isGateway = false,
}) {
  const isOnline = data.status === "connected";
  const accent = accentColor;
  const handles = data.sourceHandles ?? [];
  const nw = data.nodeWidth ?? NODE_W;

  const mistType = isGateway ? "gateway" : "switch";
  const orgId = process.env.REACT_APP_MIST_ORG_ID;
  const mistUrl = `https://manage.mist.com/admin/?org_id=${orgId}#!${mistType}/detail/${id}/${data.siteId ?? ""}`;

  const glow = data.highlighted
    ? `0 0 0 2px ${accent}, 0 0 16px ${accent}88, 0 4px 20px rgba(0,0,0,.5)`
    : "0 4px 20px rgba(0,0,0,.5)";

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
        <div className="flex gap-1">
          {data.ip && (
            <button
              onClick={() => navigator.clipboard.writeText(data.ip)}
              className="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-400 transition-colors font-mono"
            >
              Copy IP
            </button>
          )}
          <a
            href={mistUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-600 text-blue-400 hover:bg-gray-700 hover:border-blue-500 transition-colors"
          >
            Open in Mist ↗
          </a>
        </div>
      </NodeToolbar>
      <div
        style={{
          border: `2px solid ${accent}`,
          background: "#111827",
          borderRadius: 8,
          padding: "10px 12px",
          minWidth: nw,
          width: nw,
          boxShadow: glow,
          position: "relative",
          cursor: data.hasChildren ? "pointer" : "default",
          transition: "box-shadow 0.15s ease",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: accent, width: 8, height: 8 }}
        />

        {/* hide source handles when collapsed since those edges aren't visible anyway */}
        {!data.isCollapsed && handles.length > 0 ? (
          handles.map((h) => (
            <Handle
              key={h.id}
              id={h.id}
              type="source"
              position={Position.Bottom}
              style={{
                left: `${h.leftPct}%`,
                background: accent,
                width: 8,
                height: 8,
              }}
            />
          ))
        ) : (
          <Handle
            type="source"
            position={Position.Bottom}
            style={{ opacity: 0, pointerEvents: "none" }}
          />
        )}

        <div
          style={{
            color: accent,
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1.3,
          }}
        >
          {data.name}
        </div>
        <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 6 }}>
          {data.model}
        </div>

        <div
          style={{
            borderTop: "1px solid #374151",
            paddingTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {[
            [
              "Status",
              isOnline ? "Online" : "Offline",
              isOnline ? "#4ade80" : "#f87171",
            ],
            ["IP", data.ip || "—", "#d1d5db"],
            ["Version", data.version || "—", "#d1d5db"],
            ...(data.uptime
              ? [["Uptime", formatUptime(data.uptime), "#d1d5db"]]
              : []),
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                gap: 8,
              }}
            >
              <span style={{ color: "#6b7280" }}>{label}</span>
              <span
                style={{
                  color,
                  fontWeight: label === "Status" ? 600 : 400,
                  fontFamily: label === "IP" ? "monospace" : undefined,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* expand/collapse hint at the bottom of the card */}
        {data.hasChildren && (
          <div
            style={{
              borderTop: "1px solid #1f2937",
              marginTop: 6,
              paddingTop: 5,
              textAlign: "center",
              fontSize: 9,
              userSelect: "none",
              color: data.isCollapsed ? "#60a5fa" : "#4b5563",
              letterSpacing: "0.03em",
            }}
          >
            {data.isCollapsed
              ? `▶  ${data.hiddenCount} device${data.hiddenCount !== 1 ? "s" : ""} hidden — double-click to expand`
              : "▼  double-click to collapse"}
          </div>
        )}
      </div>
    </>
  );
}

const RouterNode = ({ data, selected, id }) => (
  <DeviceNode
    data={data}
    selected={selected}
    id={id}
    accentColor="#ef4444"
    isGateway
  />
);
const SwdNode = ({ data, selected, id }) => (
  <DeviceNode data={data} selected={selected} id={id} accentColor="#a855f7" />
);
const AggNode = ({ data, selected, id }) => (
  <DeviceNode data={data} selected={selected} id={id} accentColor="#f97316" />
);
const SwitchNode = ({ data, selected, id }) => (
  <DeviceNode data={data} selected={selected} id={id} accentColor="#3b82f6" />
);

function WirelessNode() {
  return (
    <div
      style={{
        border: "2px dashed #06b6d4",
        background: "#0c1a1f",
        borderRadius: 8,
        padding: "10px 14px",
        width: 160,
        textAlign: "center",
        boxShadow: "0 0 14px #06b6d444, 0 4px 20px rgba(0,0,0,.5)",
      }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#06b6d4", width: 8, height: 8 }}
      />
      <svg
        width="26"
        height="22"
        viewBox="0 0 24 20"
        fill="none"
        stroke="#06b6d4"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ margin: "0 auto 6px", display: "block" }}
      >
        <path d="M1 5.5a15.5 15.5 0 0 1 22 0" />
        <path d="M4.5 9.5a11 11 0 0 1 15 0" />
        <path d="M8 13.5a6 6 0 0 1 8 0" />
        <circle cx="12" cy="17" r="1.2" fill="#06b6d4" stroke="none" />
      </svg>
      <div
        style={{
          color: "#06b6d4",
          fontWeight: 700,
          fontSize: 11,
          lineHeight: 1.3,
        }}
      >
        Wireless Bridge
      </div>
      <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 2 }}>
        Nanobeam
      </div>
    </div>
  );
}

const nodeTypes = {
  routerNode: RouterNode,
  swdNode: SwdNode,
  aggNode: AggNode,
  switchNode: SwitchNode,
  wirelessNode: WirelessNode,
};

// takes raw device list + detail map and returns nodes/edges ready for react flow

function buildTopology(
  devices,
  detailsMap,
  siteId,
  { hGap = H_GAP, handleSpacing = 24 } = {},
) {
  const isRouter = (d) => d.type === "gateway" || d.type === "router";
  // SWD = distribution tier (sits directly under the router)
  const isSwd = (d) => /swd\d+$/i.test(d.name ?? "");
  // AGG = aggregation tier (sits under SWD)
  const isAgg = (d) => /agg\d*$/i.test(d.name ?? "");

  const deviceByMac = {};
  devices.forEach((d) => {
    if (d.mac) deviceByMac[normMac(d.mac)] = d;
    if (d.chassis_mac) deviceByMac[normMac(d.chassis_mac)] = d;
    if (d._id) deviceByMac[normMac(d._id)] = d;
  });

  // Juniper switches often advertise a per-port MAC in LLDP rather than the chassis MAC.
  // Add every port_mac from detail data so those LLDP advertisements can be resolved.
  // Also index HA cluster node MACs from module_stat/module2_stat — SRX HA pairs have
  // two nodes each with their own MAC; only d.mac covers node 0.
  devices.forEach((d) => {
    const detail = detailsMap[d.id];
    for (const member of detail?.custom?.vc_members ?? []) {
      for (const pic of member.pics ?? []) {
        for (const port of pic.ports ?? []) {
          if (port.port_mac) deviceByMac[normMac(port.port_mac)] = d;
        }
      }
    }
    for (const mod of [
      ...(detail?.module_stat ?? []),
      ...(detail?.module2_stat ?? []),
    ]) {
      if (mod.mac) deviceByMac[normMac(mod.mac)] = d;
    }
  });

  // Name-based device index — fallback when LLDP advertises a virtual MAC (RETH, LAG)
  // that isn't tracked in deviceByMac. Strips _nodeN suffix before inserting.
  const deviceByName = {};
  devices.forEach((d) => {
    if (d.name) deviceByName[d.name.toLowerCase()] = d;
  });

  // find physical connections using LLDP neighbor data
  const rawEdges = [];
  const seen = new Set();

  devices.forEach((dev) => {
    const detail = detailsMap[dev.id];
    if (!detail?.clients) return;

    detail.clients
      .filter((c) => c.source === "lldp")
      .forEach((c) => {
        let peer = deviceByMac[normMac(c.mac)];

        // Fallback: LLDP entry whose MAC is a virtual/RETH address not in deviceByMac.
        // Scan this device's vc_members for a port matching one of the client port_ids
        // that has a neighbor_system_name we can resolve by name.
        if (!peer && c.source === "lldp") {
          const clientPorts = new Set(c.port_ids ?? []);
          outer: for (const member of detail?.custom?.vc_members ?? []) {
            for (const pic of member.pics ?? []) {
              for (const port of pic.ports ?? []) {
                if (!clientPorts.has(port.port_id)) continue;
                const sn = (port.neighbor_system_name ?? "")
                  .replace(/_node\d+$/i, "")
                  .toLowerCase();
                if (sn && deviceByName[sn]) {
                  peer = deviceByName[sn];
                  break outer;
                }
              }
            }
          }
        }

        if (!peer || peer.id === dev.id) return;

        const edgeKey = [dev.id, peer.id].sort().join("|");
        if (seen.has(edgeKey)) return;
        seen.add(edgeKey);

        const localPort =
          c.port_ids?.[0] ?? c.port_id?.split(",")?.[0]?.trim() ?? "?";
        const peerDetail = detailsMap[peer.id];
        const peerClient =
          peerDetail?.clients?.find(
            (pc) =>
              pc.source === "lldp" &&
              deviceByMac[normMac(pc.mac)]?.id === dev.id,
          ) ??
          peerDetail?.clients?.find(
            (pc) => deviceByMac[normMac(pc.mac)]?.id === dev.id,
          );

        const peerPort =
          peerClient?.port_ids?.[0] ??
          peerClient?.port_id ??
          resolvePortFromPortDetails(detail, localPort) ??
          resolvePortByNeighborName(peerDetail, dev.name) ??
          "?";

        const ifKey = `${localPort}.0`;
        const linkUp = detail.if_stat?.[ifKey]?.up ?? true;
        const mediaType = getPortMediaType(detail, localPort);
        const color = getLinkColor(mediaType, linkUp);

        rawEdges.push({
          edgeKey,
          devId: dev.id,
          peerId: peer.id,
          devPort: localPort,
          peerPort,
          color,
        });
      });
  });

  // Wireless edge detection: if a Nanobeam operates in transparent bridge mode the
  // upstream Juniper switch's MAC passes through and neighbor_mac resolves in deviceByMac.
  // Scan every uplink port with an empty neighbor_system_name for that case.
  devices.forEach((dev) => {
    for (const member of detailsMap[dev.id]?.custom?.vc_members ?? []) {
      for (const pic of member.pics ?? []) {
        for (const port of pic.ports ?? []) {
          const mac = normMac(port.neighbor_mac ?? "");
          if (
            port.port_usage === "uplink" &&
            port.uplink === true &&
            !port.neighbor_system_name &&
            mac.length === 12
          ) {
            const peer = deviceByMac[mac];
            if (!peer || peer.id === dev.id) continue;
            const edgeKey = [dev.id, peer.id].sort().join("|");
            if (seen.has(edgeKey)) continue;
            seen.add(edgeKey);
            rawEdges.push({
              edgeKey,
              devId: dev.id,
              peerId: peer.id,
              devPort: port.port_id,
              peerPort: "?",
              color: "#06b6d4",
              wireless: true,
            });
          }
        }
      }
    }
  });

  // figure out how far each device is from the router (depth in the tree)
  const adjacency = {};
  devices.forEach((d) => (adjacency[d.id] = []));
  rawEdges.forEach((e) => {
    adjacency[e.devId]?.push(e.peerId);
    adjacency[e.peerId]?.push(e.devId);
  });

  // BFS starts from routers only so SWD/AGG get their correct rank from LLDP connections.
  // Fallback chain if no router: use SWD, then AGG, then most-connected device.
  const rootIds = devices.filter(isRouter).map((d) => d.id);
  if (rootIds.length === 0) {
    const swds = devices.filter(isSwd);
    if (swds.length > 0) {
      swds.forEach((d) => rootIds.push(d.id));
    } else {
      const aggs = devices.filter(isAgg);
      if (aggs.length > 0) {
        aggs.forEach((d) => rootIds.push(d.id));
      } else if (devices.length > 0) {
        const sorted = [...devices].sort(
          (a, b) =>
            (adjacency[b.id]?.length ?? 0) - (adjacency[a.id]?.length ?? 0),
        );
        rootIds.push(sorted[0].id);
      }
    }
  }

  // assign ranks by naming tier first so the hierarchy is always correct,
  // even when LLDP data is partial or asymmetric
  const hasRouter = devices.some(isRouter);
  const hasSwd = devices.some(isSwd);

  const swdRank = hasRouter ? 1 : 0;
  const aggRank = hasSwd ? swdRank + 1 : swdRank;

  const rankPre = {};
  devices.forEach((d) => {
    if (isRouter(d)) rankPre[d.id] = 0;
    else if (isSwd(d)) rankPre[d.id] = swdRank;
    else if (isAgg(d)) rankPre[d.id] = aggRank;
    // regular switches get their rank from BFS below
  });

  // BFS outward from all tier-ranked devices to rank regular access switches by hop count
  const tieredIds = devices
    .filter((d) => rankPre[d.id] !== undefined)
    .map((d) => d.id);
  const q0 = [...tieredIds];
  let h0 = 0;
  while (h0 < q0.length) {
    const cur = q0[h0++];
    (adjacency[cur] ?? []).forEach((nb) => {
      if (rankPre[nb] === undefined) {
        rankPre[nb] = rankPre[cur] + 1;
        q0.push(nb);
      }
    });
  }
  // anything still unranked (no LLDP path at all) lands at the bottom of its tier
  devices.forEach((d) => {
    if (rankPre[d.id] === undefined) rankPre[d.id] = aggRank + 1;
  });

  // make sure every edge points from upstream (parent) down to downstream (child)
  const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]));
  const portOnParent = {};

  const edgeList = rawEdges.map((e) => {
    const devRank = rankPre[e.devId] ?? 0;
    const peerRank = rankPre[e.peerId] ?? 0;
    const parentFirst = devRank <= peerRank;
    const parentId = parentFirst ? e.devId : e.peerId;
    const childId = parentFirst ? e.peerId : e.devId;
    const parentPort = parentFirst ? e.devPort : e.peerPort;
    const childPort = parentFirst ? e.peerPort : e.devPort;
    const parentName = deviceById[parentId]?.name ?? parentId;
    const childName = deviceById[childId]?.name ?? childId;
    if (portOnParent[childId] === undefined) portOnParent[childId] = parentPort;
    return {
      id: `e-${e.edgeKey}`,
      source: parentId,
      target: childId,
      type: e.wireless ? "wirelessEdge" : "hoverEdge",
      style: e.wireless
        ? { stroke: "#06b6d4", strokeWidth: 2, strokeDasharray: "8 4" }
        : { stroke: e.color, strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.wireless ? "#06b6d4" : e.color,
      },
      data: { parentPort, childPort, parentName, childName },
    };
  });

  // node widths - widen nodes that have lots of children so handles don't crowd together
  // need edgesByParent first for the child count, will sort by position after layout
  const edgesByParent = {};
  edgeList.forEach((e) => {
    (edgesByParent[e.source] ??= []).push(e);
  });

  // widen the card so handles stay inside at handleSpacing px min gap
  const nodeWidths = {};
  devices.forEach((d) => {
    const n = (edgesByParent[d.id] ?? []).length;
    nodeWidths[d.id] =
      n <= 1
        ? NODE_W
        : Math.max(NODE_W, Math.ceil(((n - 1) * handleSpacing) / 0.7) + 40);
  });

  // run the layout now that we know each node's actual width
  const { positions } = treeLayout(
    devices.map((d) => d.id),
    rootIds,
    adjacency,
    portOnParent,
    nodeWidths,
    rankPre,
    hGap,
  );

  // assign handles spread left to right, sorted by where the child landed in the layout
  const nodeSourceHandles = {};
  const childrenMap = {};

  Object.entries(edgesByParent).forEach(([parentId, edges]) => {
    edges.sort(
      (a, b) => (positions[a.target]?.x ?? 0) - (positions[b.target]?.x ?? 0),
    );
    childrenMap[parentId] = edges.map((e) => e.target);
    const n = edges.length;
    nodeSourceHandles[parentId] = edges.map((e, idx) => {
      const leftPct = n === 1 ? 50 : 15 + (idx / (n - 1)) * 70;
      const handleId = `sh-${e.id}`;
      e.sourceHandle = handleId;
      return { id: handleId, leftPct };
    });
  });

  // anything with no connections goes to the side list instead of the diagram
  const connectedIds = new Set();
  edgeList.forEach((e) => {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  });

  // Detect all devices that have a Nanobeam-style uplink (uplink=true, no LLDP system name,
  // valid neighbor_mac). This covers both devices already in the topology via other links
  // AND isolated devices whose only path is through a wireless bridge.
  const nanobeamDeviceIds = new Set();
  devices.forEach((dev) => {
    for (const member of detailsMap[dev.id]?.custom?.vc_members ?? []) {
      for (const pic of member.pics ?? []) {
        for (const port of pic.ports ?? []) {
          if (
            port.port_usage === "uplink" &&
            port.uplink === true &&
            !port.neighbor_system_name &&
            normMac(port.neighbor_mac ?? "").length === 12
          ) {
            nanobeamDeviceIds.add(dev.id);
          }
        }
      }
    }
  });

  // Devices whose ONLY upstream path is through a Nanobeam — no Mist LLDP peers at all.
  // Show them in the topology connected to the wireless cloud node, not in offlineIsolated.
  const nanobeamOnlyIds = new Set(
    [...nanobeamDeviceIds].filter((id) => !connectedIds.has(id)),
  );

  const offlineIsolated = devices.filter(
    (d) => !connectedIds.has(d.id) && !nanobeamOnlyIds.has(d.id),
  );
  const linkedDevices = devices.filter((d) => connectedIds.has(d.id));

  const nodes = linkedDevices.map((d) => ({
    id: d.id,
    type: isRouter(d)
      ? "routerNode"
      : isSwd(d)
        ? "swdNode"
        : isAgg(d)
          ? "aggNode"
          : "switchNode",
    position: positions[d.id] ?? { x: 0, y: 0 },
    data: {
      name: d.name,
      model: d.model,
      ip: d.ip,
      status: d.status,
      version: d.version,
      uptime: d.uptime,
      siteId,
      sourceHandles: nodeSourceHandles[d.id] ?? [],
      nodeWidth: nodeWidths[d.id] ?? NODE_W,
    },
  }));

  if (nanobeamDeviceIds.size > 0) {
    const positionedNano = [...nanobeamDeviceIds].filter((id) => positions[id]);
    const avgX =
      positionedNano.length > 0
        ? positionedNano.reduce((s, id) => s + positions[id].x, 0) /
          positionedNano.length
        : nodes.length > 0
          ? nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length
          : 0;
    const refY =
      positionedNano.length > 0
        ? Math.min(...positionedNano.map((id) => positions[id].y))
        : nodes.length > 0
          ? Math.min(...nodes.map((n) => n.position.y))
          : NODE_H + V_GAP;

    const wirelessId = "wireless-cloud";
    const cloudX = avgX - 80;
    const cloudY = refY - NODE_H - V_GAP;

    nodes.push({
      id: wirelessId,
      type: "wirelessNode",
      position: { x: cloudX, y: cloudY },
      data: { name: "Wireless Bridge" },
    });

    // Isolated Nanobeam-only devices: add as nodes in a row below the cloud
    [...nanobeamOnlyIds].forEach((devId, idx) => {
      const dev = devices.find((d) => d.id === devId);
      if (!dev) return;
      nodes.push({
        id: devId,
        type: isRouter(dev)
          ? "routerNode"
          : isSwd(dev)
            ? "swdNode"
            : isAgg(dev)
              ? "aggNode"
              : "switchNode",
        position: {
          x: cloudX - 80 + idx * (NODE_W + hGap),
          y: cloudY + NODE_H + V_GAP,
        },
        data: {
          name: dev.name,
          model: dev.model,
          ip: dev.ip,
          status: dev.status,
          version: dev.version,
          uptime: dev.uptime,
          siteId,
          sourceHandles: [],
          nodeWidth: nodeWidths[devId] ?? NODE_W,
        },
      });
    });

    // Wireless edges: cloud → every Nanobeam device (connected + isolated)
    nanobeamDeviceIds.forEach((devId) => {
      edgeList.push({
        id: `e-wireless-${devId}`,
        source: wirelessId,
        target: devId,
        type: "wirelessEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#06b6d4" },
        data: {},
      });
    });
  }

  return { nodes, edges: edgeList, offlineIsolated, childrenMap };
}

// ── Main Component ────────────────────────────────────────────────────────────

const EMPTY_RAW = { nodes: [], edges: [], childrenMap: {} };

export default function TopologyView() {
  const BASE = `https://${process.env.REACT_APP_API_BASEURL}/api`;
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };

  const [siteList, setSiteList] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [isLoadingTopo, setIsLoadingTopo] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState(null);
  const [offlineIsolated, setOfflineIsolated] = useState([]);

  const [rawData, setRawData] = useState(EMPTY_RAW);
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [searchText, setSearchText] = useState("");
  const [rfInstance, setRfInstance] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showPortLabels, setShowPortLabels] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const rawInputRef = useRef(null);

  // Re-layout when port label toggle changes — wider nodes + gaps when on
  useEffect(() => {
    const ri = rawInputRef.current;
    if (!ri) return;
    const opts = showPortLabels ? { hGap: H_GAP * 3, handleSpacing: 64 } : {};
    const {
      nodes: n,
      edges: e,
      offlineIsolated: ol,
      childrenMap: cm,
    } = buildTopology(ri.devices, ri.detailsMap, ri.siteId, opts);
    setOfflineIsolated(ol);
    setRawData({ nodes: n, edges: e, childrenMap: cm });
  }, [showPortLabels]);

  const getToken = useCallback(async () => {
    try {
      const r = await instance.acquireTokenSilent(request);
      return r.accessToken;
    } catch (silentErr) {
      console.warn("Silent token acquisition failed, redirecting to re-auth:", silentErr);
      // Full-page redirect, not a popup — this app's redirectUri points at the SPA root, so
      // a popup just loads the whole app inside itself instead of closing. Redirect reuses
      // the already-registered URI (no Azure changes needed) and navigates the tab away, so
      // this never meaningfully returns — the user lands back freshly authenticated and
      // just retries whatever they were doing.
      await instance.acquireTokenRedirect(request);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  const authFetch = useCallback(
    async (url) => {
      const token = await getToken();
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        if (res.status === 401)
          throw new Error(
            "Session expired. Please try again to refresh your token.",
          );
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
    [getToken],
  );

  useEffect(() => {
    if (!rawData.nodes.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { visibleNodes, visibleEdges } = computeVisible(
      rawData.nodes,
      rawData.edges,
      collapsedIds,
      rawData.childrenMap,
    );
    // Preserve any positions the user may have dragged nodes to
    setNodes((prev) => {
      const posMap = Object.fromEntries(prev.map((n) => [n.id, n.position]));
      return visibleNodes.map((n) => ({
        ...n,
        position: posMap[n.id] ?? n.position,
      }));
    });
    setEdges(visibleEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, collapsedIds]);

  const onEdgeMouseEnter = useCallback(
    (_, edge) => {
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: {
            ...n.data,
            highlighted: n.id === edge.source || n.id === edge.target,
          },
        })),
      );
    },
    [setNodes],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, highlighted: false },
      })),
    );
  }, [setNodes]);

  const onNodeDoubleClick = useCallback(
    (_, node) => {
      if (!(rawData.childrenMap[node.id] ?? []).length) return;
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    },
    [rawData.childrenMap],
  );

  useEffect(() => {
    if (accounts.length === 0) return;
    setIsLoadingSites(true);
    setError(null);
    authFetch(`${BASE}/mist/site/summary`)
      .then((d) => setSiteList(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e) => {
        console.error("Failed to load sites:", e);
        setError(e.message || "Failed to load site list — please try again.");
      })
      .finally(() => setIsLoadingSites(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, retryKey]);

  useEffect(() => {
    if (!selectedSiteId) return;
    void retryKey; // retryKey increment forces this effect to re-run on "Try again"
    let cancelled = false;
    setIsLoadingTopo(true);
    setError(null);
    setRawData(EMPTY_RAW);
    setCollapsedIds(new Set());
    setOfflineIsolated([]);
    setShowPortLabels(false);
    rawInputRef.current = null;

    (async () => {
      try {
        setLoadingStatus("Loading devices…");
        const raw = await authFetch(
          `${BASE}/mist/site/${selectedSiteId}/devicesummary`,
        );
        const all = Array.isArray(raw) ? raw : (raw.data ?? []);
        const devices = all.filter(
          (d) =>
            d.type === "switch" || d.type === "gateway" || d.type === "router",
        );

        if (devices.length === 0) {
          if (!cancelled) setRawData(EMPTY_RAW);
          return;
        }

        const BATCH_SIZE = 60;
        const BATCH_DELAY_MS = 1000;
        const detailsMap = {};
        let fetchedCount = 0;
        const total = devices.length;
        setLoadingStatus(`0/${total}`);

        for (let i = 0; i < devices.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = devices.slice(i, i + BATCH_SIZE);

          // eslint-disable-next-line no-loop-func
          const results = await Promise.allSettled(
            batch.map((d) =>
              authFetch(
                `${BASE}/mist/site/${selectedSiteId}/device/${d.id}/details`,
              )
                .then((r) => {
                  fetchedCount++;
                  if (!cancelled) setLoadingStatus(`${fetchedCount}/${total}`);
                  return r;
                })
                .catch((e) => {
                  fetchedCount++;
                  if (!cancelled) setLoadingStatus(`${fetchedCount}/${total}`);
                  throw e;
                }),
            ),
          );
          batch.forEach((d, j) => {
            if (results[j].status === "fulfilled")
              detailsMap[d.id] = results[j].value;
          });

          if (i + BATCH_SIZE < devices.length) {
            await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
          }
        }

        if (!cancelled) {
          const {
            nodes: n,
            edges: e,
            offlineIsolated: ol,
            childrenMap: cm,
          } = buildTopology(devices, detailsMap, selectedSiteId);

          rawInputRef.current = { devices, detailsMap, siteId: selectedSiteId };
          setOfflineIsolated(ol);
          setCollapsedIds(new Set());
          setRawData({ nodes: n, edges: e, childrenMap: cm });
        }
      } catch (err) {
        console.error("Topology load failed:", err);
        if (!cancelled) setError("Failed to load topology data.");
      } finally {
        if (!cancelled) {
          setIsLoadingTopo(false);
          setLoadingStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, retryKey]);

  const isCollapsible = rawData.nodes.some(
    (n) => (rawData.childrenMap[n.id] ?? []).length > 0,
  );

  const handleSearch = useCallback(
    (text) => {
      if (!rfInstance || !text.trim()) return;
      const match = nodes.find((n) =>
        (n.data.name ?? "").toLowerCase().includes(text.trim().toLowerCase()),
      );
      if (!match) return;

      // If the matched node is currently hidden (collapsed ancestor), expand up to it
      setCollapsedIds((prev) => {
        const ancestors = new Set();
        const findAncestors = (nodeId) => {
          rawData.nodes.forEach((n) => {
            if ((rawData.childrenMap[n.id] ?? []).includes(nodeId)) {
              ancestors.add(n.id);
              findAncestors(n.id);
            }
          });
        };
        findAncestors(match.id);
        if ([...ancestors].every((a) => !prev.has(a))) return prev; // nothing to expand
        const next = new Set(prev);
        ancestors.forEach((a) => next.delete(a));
        return next;
      });

      // Slight delay so expanded nodes have time to render before flying to them
      setTimeout(() => {
        rfInstance.setCenter(
          match.position.x + NODE_W / 2,
          match.position.y + NODE_H / 2,
          { zoom: 1.8, duration: 600 },
        );
        setNodes((prev) =>
          prev.map((n) => ({ ...n, selected: n.id === match.id })),
        );
      }, 50);
    },
    [rfInstance, nodes, rawData, setNodes],
  );

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => {
    const next = new Set();
    rawData.nodes.forEach((n) => {
      if ((rawData.childrenMap[n.id] ?? []).length > 0) {
        next.add(n.id);
      }
    });
    setCollapsedIds(next);
  }, [rawData]);

  return (
    <div className="p-6 text-gray-100">
      <div className="mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Network Topology
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
          </h1>
          <p className="text-sm text-pink-400">
            Hover a link to see port labels
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-full max-w-sm">
            <Autocomplete
              label="Site Code"
              menuTrigger="input"
              placeholder="Site Code"
              className="dark"
              variant="bordered"
              isLoading={isLoadingSites}
              onSelectionChange={(key) => setSelectedSiteId(key)}
            >
              {siteList.map((site) => (
                <AutocompleteItem key={site.id} value={site.id}>
                  {site.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        </div>

        {isLoadingTopo ? (
          <div className="flex flex-col justify-center items-center py-32 gap-3">
            {(() => {
              const match = loadingStatus?.match(/(\d+)\/(\d+)/);
              const done = match ? parseInt(match[1]) : 0;
              const total = match ? parseInt(match[2]) : 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div className="flex flex-col items-center gap-3 w-56">
                  {total === 0 ? (
                    <>
                      <svg
                        className="animate-spin w-6 h-6 text-pink-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      <p className="text-sm text-gray-400">Loading devices…</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-400">
                        Loading device details…
                      </p>
                      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pink-400 to-pink-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        <span className="text-white font-medium">{done}</span> /{" "}
                        {total} devices ({pct}%)
                      </p>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center py-32 gap-3 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="text-red-400 text-sm max-w-sm font-semibold">{error}</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="text-xs px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : nodes.length === 0 && selectedSiteId && !isLoadingTopo && !error ? (
          <div className="flex justify-center items-center py-32">
            <p className="text-gray-500 text-sm">
              No switches or routers found for this site.
            </p>
          </div>
        ) : nodes.length > 0 ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-2 px-1 gap-3">
              <p className="text-xs text-gray-500 shrink-0">
                {rawData.nodes.length} device
                {rawData.nodes.length !== 1 ? "s" : ""} in topology
                {collapsedIds.size > 0 && (
                  <span className="text-blue-400 ml-2">
                    ({collapsedIds.size} node
                    {collapsedIds.size !== 1 ? "s" : ""} collapsed)
                  </span>
                )}
              </p>

              {/* Search */}
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Search device name…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSearch(searchText)
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={() => handleSearch(searchText)}
                  className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors shrink-0"
                >
                  Go
                </button>
                {searchText &&
                  !nodes.find((n) =>
                    (n.data.name ?? "")
                      .toLowerCase()
                      .includes(searchText.toLowerCase()),
                  ) && (
                    <span className="text-xs text-red-400 shrink-0">
                      No match
                    </span>
                  )}
              </div>

              {isCollapsible && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={expandAll}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Expand all
                  </button>
                  <button
                    onClick={collapseAll}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Collapse all
                  </button>
                </div>
              )}
            </div>

            <div
              style={{ height: "75vh" }}
              className="rounded-xl border border-gray-700"
            >
              <PortLabelsCtx.Provider value={showPortLabels}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onEdgeMouseEnter={onEdgeMouseEnter}
                  onEdgeMouseLeave={onEdgeMouseLeave}
                  onInit={setRfInstance}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.15 }}
                  minZoom={0.1}
                  proOptions={{ hideAttribution: true }}
                  deleteKeyCode={null}
                  nodesConnectable={false}
                >
                  <Background color="#374151" gap={20} />
                  <Controls />
                  <MiniMap
                    nodeColor={(n) =>
                      n.type === "routerNode"
                        ? "#ef4444"
                        : n.type === "swdNode"
                          ? "#a855f7"
                          : n.type === "aggNode"
                            ? "#f97316"
                            : "#3b82f6"
                    }
                    maskColor="rgba(17,24,39,0.8)"
                    className="!bg-gray-900 !border-gray-700"
                    zoomable
                    pannable
                  />
                  <Panel position="bottom-center">
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-500 bg-gray-950/80 px-3 py-1.5 rounded-lg border border-gray-800 backdrop-blur-sm">
                      <span>Hover link = port info</span>
                      <span className="text-gray-700">|</span>
                      <span>Drag nodes</span>
                      {isCollapsible && (
                        <>
                          <span className="text-gray-700">|</span>
                          <span>Double-click node = collapse</span>
                        </>
                      )}
                      <span className="text-gray-700">|</span>
                      <span className="text-red-400">Red = router</span>
                      <span className="text-purple-400">Purple = SWD</span>
                      <span className="text-orange-400">Orange = AGG</span>
                      <span className="text-blue-400">Blue = copper</span>
                      <span className="text-amber-400">Yellow = fiber</span>
                      <span className="text-cyan-400">
                        Cyan dashed = wireless
                      </span>
                    </div>
                  </Panel>
                  <Panel position="top-right">
                    <button
                      onClick={() => setShowPortLabels((v) => !v)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors font-mono ${
                        showPortLabels
                          ? "bg-pink-500/20 border-pink-500 text-pink-300"
                          : "bg-gray-900/80 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                      }`}
                    >
                      {showPortLabels ? "Hide ports" : "Show ports"}
                    </button>
                  </Panel>
                </ReactFlow>
              </PortLabelsCtx.Provider>
            </div>

            {offlineIsolated.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                  No Link Data ({offlineIsolated.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {offlineIsolated.map((d) => (
                    <div
                      key={d.id}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs space-y-0.5"
                    >
                      <div className="font-semibold text-gray-300 truncate">
                        {d.name}
                      </div>
                      <div className="text-gray-500 truncate">
                        {d.model || "—"}
                      </div>
                      <div
                        className={
                          d.status === "connected"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {d.status === "connected" ? "Online" : "Offline"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center items-center py-32">
            <p className="text-gray-600 text-sm">
              Select a site above to load topology
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
