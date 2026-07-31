import { graphlib, layout as dagreLayout } from "@dagrejs/dagre";

export const NODE_W = 190;
export const NODE_H = 150;
const H_GAP = 60;
const V_GAP = 120;

const ROLE_RANK = { router: 0, distribution: 1, aggregation: 2, access: 3 };

const NODE_TYPE_BY_ROLE = {
  router: "routerNode",
  distribution: "swdNode",
  aggregation: "aggNode",
  wireless_bridge: "wirelessBridgeNode",
};

function formatUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Ranks and positions nodes with dagre's layered layout instead of a hand-rolled
// "one global row per role tier" grid. A plain per-tier grid puts every access
// device from every branch in one row sorted by port name, with no regard for
// which parent it actually belongs to — fine for a single-branch tree, but this
// page can have several independent branches (one per location) sharing a tier,
// which scattered a branch's devices across the row far from their parent.
// dagre's ordering pass groups each branch together and minimizes edge crossings.
// Role tiers are preserved by giving each edge between two tiered roles a
// minlen equal to the exact gap between their tiers (e.g. a distribution device
// linking straight to an access device, skipping aggregation, still gets
// minlen=2 so the access device lands in the access row, not the aggregation
// row). Edges touching an untiered role (wireless_bridge) fall back to minlen=1.
function layoutWithDagre(graphNodes, graphLinks, nodeWidths) {
  const roleById = Object.fromEntries(graphNodes.map((n) => [n.id, n.role]));

  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: H_GAP, ranksep: V_GAP });
  g.setDefaultEdgeLabel(() => ({}));

  graphNodes.forEach((n) => {
    g.setNode(n.id, { width: nodeWidths[n.id] ?? NODE_W, height: NODE_H });
  });

  graphLinks.forEach((l) => {
    const sourceRank = ROLE_RANK[roleById[l.source.deviceId]];
    const targetRank = ROLE_RANK[roleById[l.target.deviceId]];
    const minlen =
      sourceRank !== undefined && targetRank !== undefined ? Math.max(1, targetRank - sourceRank) : 1;
    g.setEdge(l.source.deviceId, l.target.deviceId, { minlen });
  });

  dagreLayout(g);

  const positions = {};
  graphNodes.forEach((n) => {
    const dn = g.node(n.id);
    const w = nodeWidths[n.id] ?? NODE_W;
    positions[n.id] = dn ? { x: dn.x - w / 2, y: dn.y - NODE_H / 2 } : { x: 0, y: 0 };
  });
  return positions;
}

export function buildSiteDiagramTopology(graphNodes, graphLinks) {
  const nodeById = Object.fromEntries(graphNodes.map((n) => [n.id, n]));

  const childrenMap = {};
  graphLinks.forEach((l) => {
    const parentId = l.source.deviceId;
    const childId = l.target.deviceId;
    (childrenMap[parentId] ??= []).push(childId);
  });

  const nodeWidths = {};
  graphNodes.forEach((n) => {
    const childCount = (childrenMap[n.id] ?? []).length;
    nodeWidths[n.id] =
      childCount <= 1
        ? NODE_W
        : Math.max(NODE_W, Math.ceil(((childCount - 1) * 24) / 0.7) + 40);
  });

  const positions = layoutWithDagre(graphNodes, graphLinks, nodeWidths);

  const nodeSourceHandles = {};
  Object.entries(childrenMap).forEach(([parentId, childIds]) => {
    const sorted = [...childIds].sort(
      (a, b) => (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0),
    );
    const n = sorted.length;
    nodeSourceHandles[parentId] = sorted.map((childId, idx) => ({
      id: `sh-${parentId}-${childId}`,
      childId,
      leftPct: n === 1 ? 50 : 15 + (idx / (n - 1)) * 70,
    }));
  });
  const handleIdFor = (parentId, childId) =>
    nodeSourceHandles[parentId]?.find((h) => h.childId === childId)?.id;

  const nodes = graphNodes.map((n) => ({
    id: n.id,
    type: NODE_TYPE_BY_ROLE[n.role] ?? "switchNode",
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: {
      name: n.name,
      vendor: n.vendor,
      model: n.model,
      ip: n.ip,
      status: n.status,
      version: n.version,
      uptime: formatUptime(n.uptimeSeconds),
      location: n.location,
      sourceHandles: nodeSourceHandles[n.id] ?? [],
      nodeWidth: nodeWidths[n.id] ?? NODE_W,
    },
  }));

  const edges = graphLinks.map((l) => {
    const parentId = l.source.deviceId;
    const childId = l.target.deviceId;
    const isWireless = l.medium === "wireless";
    const color =
      l.status === "down"
        ? "#6b7280"
        : isWireless
          ? "#06b6d4"
          : l.medium === "fiber"
            ? "#f59e0b"
            : "#3b82f6";
    return {
      id: l.id,
      source: parentId,
      target: childId,
      sourceHandle: handleIdFor(parentId, childId),
      type: isWireless ? "wirelessEdge" : "hoverEdge",
      style: isWireless
        ? { stroke: color, strokeWidth: 2, strokeDasharray: "8 4" }
        : { stroke: color, strokeWidth: 2 },
      markerEnd: { type: "arrowclosed", color },
      data: {
        parentPort: l.source.port,
        childPort: l.target.port,
        parentName: nodeById[parentId]?.name ?? parentId,
        childName: nodeById[childId]?.name ?? childId,
      },
    };
  });

  return { nodes, edges, childrenMap };
}

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

export function computeVisible(allNodes, allEdges, collapsedIds, childrenMap, hiddenLocations) {
  const collapsedHidden = new Set();
  collapsedIds.forEach((cid) => {
    const q = [...(childrenMap[cid] ?? [])];
    let h = 0;
    while (h < q.length) {
      const cur = q[h++];
      if (!collapsedHidden.has(cur)) {
        collapsedHidden.add(cur);
        (childrenMap[cur] ?? []).forEach((c) => q.push(c));
      }
    }
  });

  const locationHidden = new Set(
    allNodes.filter((n) => hiddenLocations.has(n.data.location)).map((n) => n.id),
  );

  const hidden = new Set([...collapsedHidden, ...locationHidden]);

  const hiddenLinkCounts = {};
  allEdges.forEach((e) => {
    if (locationHidden.has(e.source) && !hidden.has(e.target)) {
      hiddenLinkCounts[e.target] = (hiddenLinkCounts[e.target] ?? 0) + 1;
    }
    if (locationHidden.has(e.target) && !hidden.has(e.source)) {
      hiddenLinkCounts[e.source] = (hiddenLinkCounts[e.source] ?? 0) + 1;
    }
  });

  const visibleNodes = allNodes
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      const hasChildren = (childrenMap[n.id] ?? []).length > 0;
      const isCollapsed = collapsedIds.has(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          hasChildren,
          isCollapsed,
          hiddenCount: isCollapsed ? countDescendants(n.id, childrenMap) : 0,
          hiddenLinkCount: hiddenLinkCounts[n.id] ?? 0,
        },
      };
    });

  const visibleEdges = allEdges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target));

  return { visibleNodes, visibleEdges };
}

export function getDistinctLocations(graphNodes) {
  return [...new Set(graphNodes.map((n) => n.location).filter(Boolean))].sort();
}
