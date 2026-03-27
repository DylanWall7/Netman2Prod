import React, { useState, useCallback, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// helpers

const normMac = (mac) => (mac ?? "").toLowerCase().replace(/[^0-9a-f]/g, "");

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

function portSortKey(port) {
  return (
    (port ?? "")
      .match(/\d+/g)
      ?.map((n) => n.padStart(6, "0"))
      .join("/") ?? port ?? ""
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
const H_GAP  = 60;
const V_GAP  = 120;

function treeLayout(deviceIds, rootIds, adjacency, portOnParent, nodeWidths = {}) {
  const rank = {};
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
  deviceIds.forEach((id) => { if (rank[id] === undefined) rank[id] = 0; });

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
    ids.reduce((sum, id) => sum + nodeW(id), 0) + Math.max(0, ids.length - 1) * H_GAP;

  const maxRowW = Math.max(...Object.values(rows).map(rowTotalW));

  const positions = {};
  Object.entries(rows).forEach(([row, ids]) => {
    const y      = Number(row) * (NODE_H + V_GAP);
    const rowW   = rowTotalW(ids);
    let   x      = (maxRowW - rowW) / 2;
    ids.forEach((id) => {
      positions[id] = { x, y };
      x += nodeW(id) + H_GAP;
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
      const hasChildren  = (childrenMap[n.id] ?? []).length > 0;
      const isCollapsed  = collapsedIds.has(n.id);
      const hiddenCount  = isCollapsed ? countDescendants(n.id, childrenMap) : 0;
      return { ...n, data: { ...n.data, hasChildren, isCollapsed, hiddenCount } };
    });

  const visibleEdges = allEdges.filter(
    (e) => !hidden.has(e.source) && !hidden.has(e.target),
  );

  return { visibleNodes, visibleEdges };
}

// edge component - shows upstream/downstream port info on hover

function HoverEdge({ id, sourceX, sourceY, targetX, targetY,
                     sourcePosition, targetPosition, style, data, markerEnd }) {
  const [hovered, setHovered] = useState(false);

  const [path, lx, ly] = getBezierPath({
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <path d={path} fill="none" strokeWidth={20} stroke="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)} />
      {hovered && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`,
            pointerEvents: "none",
            zIndex: 1000,
          }} className="bg-gray-950 border border-gray-600 text-[11px] font-mono px-3 py-2 rounded shadow-xl space-y-1">
            <div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide">upstream</div>
              <div className="text-blue-300">
                {data.parentName}: <span className="text-white font-semibold">{data.parentPort}</span>
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide">downstream</div>
              <div className="text-emerald-300">
                {data.childName}: <span className="text-white font-semibold">{data.childPort}</span>
              </div>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { hoverEdge: HoverEdge };

// node card component - red for routers, orange for agg switches, blue for regular switches

function DeviceNode({ data, accentColor = "#3b82f6" }) {
  const isOnline = data.status === "connected";
  const accent   = accentColor;
  const handles  = data.sourceHandles ?? [];
  const nw       = data.nodeWidth ?? NODE_W;

  return (
    <div style={{
      border: `2px solid ${accent}`, background: "#111827", borderRadius: 8,
      padding: "10px 12px", minWidth: nw, width: nw, boxShadow: "0 4px 20px rgba(0,0,0,.5)",
      position: "relative", cursor: data.hasChildren ? "pointer" : "default",
    }}>
      <Handle type="target" position={Position.Top}
              style={{ background: accent, width: 8, height: 8 }} />

      {/* hide source handles when collapsed since those edges aren't visible anyway */}
      {!data.isCollapsed && handles.length > 0 ? (
        handles.map((h) => (
          <Handle key={h.id} id={h.id} type="source" position={Position.Bottom}
                  style={{ left: `${h.leftPct}%`, background: accent, width: 8, height: 8 }} />
        ))
      ) : (
        <Handle type="source" position={Position.Bottom}
                style={{ opacity: 0, pointerEvents: "none" }} />
      )}

      <div style={{ color: accent, fontWeight: 700, fontSize: 11, lineHeight: 1.3 }}>{data.name}</div>
      <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 6 }}>{data.model}</div>

      <div style={{ borderTop: "1px solid #374151", paddingTop: 6, display: "flex",
                    flexDirection: "column", gap: 2 }}>
        {[
          ["Status", isOnline ? "Online" : "Offline", isOnline ? "#4ade80" : "#f87171"],
          ["IP",      data.ip      || "—", "#d1d5db"],
          ["Version", data.version || "—", "#d1d5db"],
          ...(data.uptime ? [["Uptime", formatUptime(data.uptime), "#d1d5db"]] : []),
        ].map(([label, value, color]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between",
                                    fontSize: 10, gap: 8 }}>
            <span style={{ color: "#6b7280" }}>{label}</span>
            <span style={{ color, fontWeight: label === "Status" ? 600 : 400,
                           fontFamily: label === "IP" ? "monospace" : undefined }}>{value}</span>
          </div>
        ))}
      </div>

      {/* expand/collapse hint at the bottom of the card */}
      {data.hasChildren && (
        <div style={{
          borderTop: "1px solid #1f2937", marginTop: 6, paddingTop: 5,
          textAlign: "center", fontSize: 9, userSelect: "none",
          color: data.isCollapsed ? "#60a5fa" : "#4b5563", letterSpacing: "0.03em",
        }}>
          {data.isCollapsed
            ? `▶  ${data.hiddenCount} device${data.hiddenCount !== 1 ? "s" : ""} hidden — click to expand`
            : "▼  click to collapse"}
        </div>
      )}
    </div>
  );
}

const RouterNode = ({ data }) => <DeviceNode data={data} accentColor="#ef4444" />;
const AggNode    = ({ data }) => <DeviceNode data={data} accentColor="#f97316" />;
const SwitchNode = ({ data }) => <DeviceNode data={data} accentColor="#3b82f6" />;
const nodeTypes  = { routerNode: RouterNode, aggNode: AggNode, switchNode: SwitchNode };

// takes raw device list + detail map and returns nodes/edges ready for react flow

function buildTopology(devices, detailsMap) {
  const isRouter = (d) => d.type === "gateway" || d.type === "router";
  // AGG and SWD switches sit just below the router and act as aggregation/distro points
  const isAgg    = (d) => /agg\d*$/i.test(d.name ?? "") || /swd\d+$/i.test(d.name ?? "");

  const deviceByMac = {};
  devices.forEach((d) => {
    if (d.mac)         deviceByMac[normMac(d.mac)]         = d;
    if (d.chassis_mac) deviceByMac[normMac(d.chassis_mac)] = d;
    if (d._id)         deviceByMac[normMac(d._id)]         = d;
  });

  // find physical connections using LLDP neighbor data
  const rawEdges = [];
  const seen     = new Set();

  devices.forEach((dev) => {
    const detail = detailsMap[dev.id];
    if (!detail?.clients) return;

    detail.clients.filter((c) => c.source === "lldp").forEach((c) => {
      const peer = deviceByMac[normMac(c.mac)];
      if (!peer || peer.id === dev.id) return;

      const edgeKey = [dev.id, peer.id].sort().join("|");
      if (seen.has(edgeKey)) return;
      seen.add(edgeKey);

      const localPort  = c.port_ids?.[0] ?? "?";
      const peerDetail = detailsMap[peer.id];
      const peerClient =
        peerDetail?.clients?.find((pc) =>
          pc.source === "lldp" && deviceByMac[normMac(pc.mac)]?.id === dev.id) ??
        peerDetail?.clients?.find((pc) =>
          deviceByMac[normMac(pc.mac)]?.id === dev.id);

      const peerPort =
        peerClient?.port_ids?.[0] ??
        resolvePortFromPortDetails(detail, localPort) ?? "?";

      const ifKey    = `${localPort}.0`;
      const linkUp   = detail.if_stat?.[ifKey]?.up ?? true;
      const mediaType = getPortMediaType(detail, localPort);
      const color    = getLinkColor(mediaType, linkUp);

      rawEdges.push({ edgeKey, devId: dev.id, peerId: peer.id, devPort: localPort, peerPort, color });
    });
  });

  // figure out how far each device is from the router (depth in the tree)
  const adjacency = {};
  devices.forEach((d) => (adjacency[d.id] = []));
  rawEdges.forEach((e) => {
    adjacency[e.devId]?.push(e.peerId);
    adjacency[e.peerId]?.push(e.devId);
  });

  // routers and AGG switches are both treated as tree roots
  const rootIds = devices.filter((d) => isRouter(d) || isAgg(d)).map((d) => d.id);
  if (rootIds.length === 0 && devices.length > 0) {
    const sorted = [...devices].sort(
      (a, b) => (adjacency[b.id]?.length ?? 0) - (adjacency[a.id]?.length ?? 0));
    rootIds.push(sorted[0].id);
  }

  const rankPre = {};
  const q0 = [...rootIds];
  rootIds.forEach((id) => (rankPre[id] = 0));
  let h0 = 0;
  while (h0 < q0.length) {
    const cur = q0[h0++];
    (adjacency[cur] ?? []).forEach((nb) => {
      if (rankPre[nb] === undefined) { rankPre[nb] = rankPre[cur] + 1; q0.push(nb); }
    });
  }
  devices.forEach((d) => { if (rankPre[d.id] === undefined) rankPre[d.id] = 0; });

  // make sure every edge points from upstream (parent) down to downstream (child)
  const deviceById   = Object.fromEntries(devices.map((d) => [d.id, d]));
  const portOnParent = {};

  const edgeList = rawEdges.map((e) => {
    const devRank  = rankPre[e.devId]  ?? 0;
    const peerRank = rankPre[e.peerId] ?? 0;
    const parentFirst = devRank <= peerRank;
    const parentId    = parentFirst ? e.devId   : e.peerId;
    const childId     = parentFirst ? e.peerId  : e.devId;
    const parentPort  = parentFirst ? e.devPort : e.peerPort;
    const childPort   = parentFirst ? e.peerPort : e.devPort;
    const parentName  = deviceById[parentId]?.name ?? parentId;
    const childName   = deviceById[childId]?.name  ?? childId;
    if (portOnParent[childId] === undefined) portOnParent[childId] = parentPort;
    return {
      id: `e-${e.edgeKey}`, source: parentId, target: childId,
      type: "hoverEdge",
      style: { stroke: e.color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color },
      data: { parentPort, childPort, parentName, childName },
    };
  });

  // node widths - widen nodes that have lots of children so handles don't crowd together
  // need edgesByParent first for the child count, will sort by position after layout
  const edgesByParent = {};
  edgeList.forEach((e) => { (edgesByParent[e.source] ??= []).push(e); });

  // handles sit between 15% and 85% of the node width, so 24px min gap per handle
  const MIN_HANDLE_SPACING = 24;
  const nodeWidths = {};
  devices.forEach((d) => {
    const n = (edgesByParent[d.id] ?? []).length;
    nodeWidths[d.id] = n <= 1
      ? NODE_W
      : Math.max(NODE_W, Math.ceil((n - 1) * MIN_HANDLE_SPACING / 0.70) + 40);
  });

  // run the layout now that we know each node's actual width
  const { positions } = treeLayout(
    devices.map((d) => d.id), rootIds, adjacency, portOnParent, nodeWidths,
  );

  // assign handles spread left to right, sorted by where the child landed in the layout
  const nodeSourceHandles = {};
  const childrenMap = {};

  Object.entries(edgesByParent).forEach(([parentId, edges]) => {
    edges.sort((a, b) => (positions[a.target]?.x ?? 0) - (positions[b.target]?.x ?? 0));
    childrenMap[parentId] = edges.map((e) => e.target);
    const n = edges.length;
    nodeSourceHandles[parentId] = edges.map((e, idx) => {
      const leftPct  = n === 1 ? 50 : 15 + (idx / (n - 1)) * 70;
      const handleId = `sh-${e.id}`;
      e.sourceHandle = handleId;
      return { id: handleId, leftPct };
    });
  });

  // anything with no connections goes to the side list instead of the diagram
  const connectedIds = new Set();
  edgeList.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });

  const offlineIsolated = devices.filter((d) => !connectedIds.has(d.id));
  const linkedDevices   = devices.filter((d) =>  connectedIds.has(d.id));

  // put it all together into react flow node objects
  const nodes = linkedDevices.map((d) => ({
    id: d.id,
    type: isRouter(d) ? "routerNode" : isAgg(d) ? "aggNode" : "switchNode",
    position: positions[d.id] ?? { x: 0, y: 0 },
    data: {
      name: d.name, model: d.model, ip: d.ip,
      status: d.status, version: d.version, uptime: d.uptime,
      sourceHandles: nodeSourceHandles[d.id] ?? [],
      nodeWidth: nodeWidths[d.id] ?? NODE_W,
    },
  }));

  return { nodes, edges: edgeList, offlineIsolated, childrenMap };
}

// ── Main Component ────────────────────────────────────────────────────────────

const EMPTY_RAW = { nodes: [], edges: [], childrenMap: {} };

export default function TopologyView() {
  const BASE = `https://${process.env.REACT_APP_API_BASEURL}/api`;
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };

  const [siteList, setSiteList]             = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [isLoadingTopo, setIsLoadingTopo]   = useState(false);
  const [loadingStatus, setLoadingStatus]   = useState("");
  const [error, setError]                   = useState(null);
  const [offlineIsolated, setOfflineIsolated] = useState([]);

  const [rawData, setRawData]           = useState(EMPTY_RAW);
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [searchText, setSearchText]     = useState("");
  const [rfInstance, setRfInstance]     = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const getToken = useCallback(async () => {
    const r = await instance.acquireTokenSilent(request);
    return r.accessToken;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  const authFetch = useCallback(async (url) => {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [getToken]);

  useEffect(() => {
    if (!rawData.nodes.length) { setNodes([]); setEdges([]); return; }
    const { visibleNodes, visibleEdges } = computeVisible(
      rawData.nodes, rawData.edges, collapsedIds, rawData.childrenMap,
    );
    // Preserve any positions the user may have dragged nodes to
    setNodes((prev) => {
      const posMap = Object.fromEntries(prev.map((n) => [n.id, n.position]));
      return visibleNodes.map((n) => ({ ...n, position: posMap[n.id] ?? n.position }));
    });
    setEdges(visibleEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, collapsedIds]);

  const onNodeClick = useCallback((_, node) => {
    if (!(rawData.childrenMap[node.id] ?? []).length) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, [rawData.childrenMap]);

  useEffect(() => {
    if (accounts.length === 0) return;
    authFetch(`${BASE}/mist/site/summary`)
      .then((d) => setSiteList(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e) => console.error("Failed to load sites:", e))
      .finally(() => setIsLoadingSites(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  useEffect(() => {
    if (!selectedSiteId) return;
    let cancelled = false;
    setIsLoadingTopo(true);
    setError(null);
    setRawData(EMPTY_RAW);
    setCollapsedIds(new Set());
    setOfflineIsolated([]);

    (async () => {
      try {
        setLoadingStatus("Loading devices…");
        const raw = await authFetch(`${BASE}/mist/site/${selectedSiteId}/devicesummary`);
        const all = Array.isArray(raw) ? raw : (raw.data ?? []);
        const devices = all.filter(
          (d) => d.type === "switch" || d.type === "gateway" || d.type === "router");

        if (devices.length === 0) {
          if (!cancelled) setRawData(EMPTY_RAW);
          return;
        }

        const BATCH_SIZE     = 20;
        const BATCH_DELAY_MS = 5000;
        const detailsMap     = {};

        for (let i = 0; i < devices.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch   = devices.slice(i, i + BATCH_SIZE);
          const fetched = Math.min(i + BATCH_SIZE, devices.length);
          setLoadingStatus(`Fetching device details… ${fetched}/${devices.length}`);

          const results = await Promise.allSettled(
            batch.map((d) => authFetch(`${BASE}/mist/site/${selectedSiteId}/device/${d.id}/details`))
          );
          batch.forEach((d, j) => {
            if (results[j].status === "fulfilled") detailsMap[d.id] = results[j].value;
          });

          if (i + BATCH_SIZE < devices.length) {
            await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
          }
        }

        if (!cancelled) {
          const { nodes: n, edges: e, offlineIsolated: ol, childrenMap: cm } =
            buildTopology(devices, detailsMap);

          setOfflineIsolated(ol);
          setCollapsedIds(new Set());
          setRawData({ nodes: n, edges: e, childrenMap: cm });
        }
      } catch (err) {
        console.error("Topology load failed:", err);
        if (!cancelled) setError("Failed to load topology data.");
      } finally {
        if (!cancelled) { setIsLoadingTopo(false); setLoadingStatus(""); }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);

  const isCollapsible = rawData.nodes.some((n) => (rawData.childrenMap[n.id] ?? []).length > 0);

  const handleSearch = useCallback((text) => {
    if (!rfInstance || !text.trim()) return;
    const match = nodes.find((n) =>
      (n.data.name ?? "").toLowerCase().includes(text.trim().toLowerCase())
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
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === match.id })));
    }, 50);
  }, [rfInstance, nodes, rawData, setNodes]);

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => {
    const next = new Set();
    rawData.nodes.forEach((n) => {
      if ((rawData.childrenMap[n.id] ?? []).length > 0 && n.type !== "routerNode" && n.type !== "aggNode") {
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
          <p className="text-sm text-pink-400">Hover a link to see port labels</p>
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
                <AutocompleteItem key={site.id} value={site.id}>{site.name}</AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        </div>

        {isLoadingTopo ? (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <svg width="48" height="48" viewBox="0 0 24 24">
              <style>{`.sp{animation:spinner_MGfb .8s linear infinite;animation-delay:-.8s}.sp2{animation-delay:-.65s}.sp3{animation-delay:-.5s}@keyframes spinner_MGfb{93.75%,100%{opacity:.2}}`}</style>
              <circle className="sp"     cx="4"  cy="12" r="3" fill="#3b82f6" />
              <circle className="sp sp2" cx="12" cy="12" r="3" fill="#3b82f6" />
              <circle className="sp sp3" cx="20" cy="12" r="3" fill="#3b82f6" />
            </svg>
            {loadingStatus && <p className="text-sm text-gray-400">{loadingStatus}</p>}
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-32">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : nodes.length === 0 && selectedSiteId && !isLoadingTopo && !error ? (
          <div className="flex justify-center items-center py-32">
            <p className="text-gray-500 text-sm">No switches or routers found for this site.</p>
          </div>
        ) : nodes.length > 0 ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-2 px-1 gap-3">
              <p className="text-xs text-gray-500 shrink-0">
                {rawData.nodes.length} device{rawData.nodes.length !== 1 ? "s" : ""} in topology
                {collapsedIds.size > 0 && (
                  <span className="text-blue-400 ml-2">
                    ({collapsedIds.size} node{collapsedIds.size !== 1 ? "s" : ""} collapsed)
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
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(searchText)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={() => handleSearch(searchText)}
                  className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors shrink-0"
                >
                  Go
                </button>
                {searchText && !nodes.find((n) =>
                  (n.data.name ?? "").toLowerCase().includes(searchText.toLowerCase())
                ) && (
                  <span className="text-xs text-red-400 shrink-0">No match</span>
                )}
              </div>

              {isCollapsible && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={expandAll}
                          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                    Expand all
                  </button>
                  <button onClick={collapseAll}
                          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                    Collapse all
                  </button>
                </div>
              )}
            </div>

            <div style={{ height: "75vh" }}
                 className="rounded-xl border border-gray-700 overflow-hidden">
              <ReactFlow nodes={nodes} edges={edges}
                         onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                         onNodeClick={onNodeClick}
                         onInit={setRfInstance}
                         nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                         fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.1}
                         proOptions={{ hideAttribution: true }}>
                <Background color="#374151" gap={20} />
                <Controls />
                <MiniMap nodeColor={(n) => n.type === "routerNode" ? "#ef4444" : n.type === "aggNode" ? "#f97316" : "#3b82f6"}
                         maskColor="rgba(17,24,39,0.8)"
                         className="!bg-gray-900 !border-gray-700" />
              </ReactFlow>
            </div>
            <p className="text-center text-xs text-gray-600 mt-3">
              Hover any link for port info &nbsp;|&nbsp; Nodes are draggable
              {isCollapsible && <> &nbsp;|&nbsp; Click a node to collapse/expand its children</>}
              &nbsp;|&nbsp; <span className="text-red-400">Red = router</span>
              &nbsp;|&nbsp; <span className="text-orange-400">Orange = AGG/SWD</span>
              &nbsp;|&nbsp; <span className="text-blue-400">Blue link = copper</span>
              &nbsp;|&nbsp; <span className="text-amber-400">Yellow link = fiber</span>
            </p>

            {offlineIsolated.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                  No Link Data ({offlineIsolated.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {offlineIsolated.map((d) => (
                    <div key={d.id}
                         className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs space-y-0.5">
                      <div className="font-semibold text-gray-300 truncate">{d.name}</div>
                      <div className="text-gray-500 truncate">{d.model || "—"}</div>
                      <div className={d.status === "connected" ? "text-green-400" : "text-red-400"}>
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
            <p className="text-gray-600 text-sm">Select a site above to load topology</p>
          </div>
        )}
      </div>
    </div>
  );
}
