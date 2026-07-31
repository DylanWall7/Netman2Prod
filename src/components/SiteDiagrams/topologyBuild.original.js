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

function formatUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function treeLayout(deviceIds, rank, portOnParent, nodeWidths) {
  const rows = {};
  deviceIds.forEach((id) => {
    const r = rank[id] ?? 0;
    (rows[r] ??= []).push(id);
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
    const y = Number(row) * (NODE_H + V_GAP);
    let x = (maxRowW - rowTotalW(ids)) / 2;
    ids.forEach((id) => {
      positions[id] = { x, y };
      x += nodeW(id) + H_GAP;
    });
  });

  return positions;
}

function rankByRoleThenBfs(graphNodes, adjacency) {
  const rank = {};
  graphNodes.forEach((n) => {
    if (ROLE_RANK[n.role] !== undefined) rank[n.id] = ROLE_RANK[n.role];
  });
  const queue = graphNodes.filter((n) => rank[n.id] !== undefined).map((n) => n.id);
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
  const bottomRank = Math.max(...Object.values(ROLE_RANK)) + 1;
  graphNodes.forEach((n) => {
    if (rank[n.id] === undefined) rank[n.id] = bottomRank;
  });
  return rank;
}

export function buildSiteDiagramTopology(graphNodes, graphLinks) {
  const nodeById = Object.fromEntries(graphNodes.map((n) => [n.id, n]));

  const adjacency = {};
  graphNodes.forEach((n) => (adjacency[n.id] = []));
  graphLinks.forEach((l) => {
    adjacency[l.source.deviceId]?.push(l.target.deviceId);
    adjacency[l.target.deviceId]?.push(l.source.deviceId);
  });

  const rank = rankByRoleThenBfs(graphNodes, adjacency);

  const portOnParent = {};
  const childrenMap = {};
  graphLinks.forEach((l) => {
    const parentId = l.source.deviceId;
    const childId = l.target.deviceId;
    if (portOnParent[childId] === undefined) portOnParent[childId] = l.source.port;
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

  const positions = treeLayout(
    graphNodes.map((n) => n.id),
    rank,
    portOnParent,
    nodeWidths,
  );

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
