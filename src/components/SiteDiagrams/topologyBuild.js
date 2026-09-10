import { graphlib, layout as dagreLayout } from "@dagrejs/dagre";

export const NODE_W = 190;
export const NODE_H = 150;
const H_GAP = 60;
const V_GAP = 120;

// Role strings aren't a fixed enum (seen "Router", "Core Router", "Distribution", etc.) — match by keyword so a new variant like "Core Router" still gets typed correctly instead of falling back to access styling.
function nodeTypeForRole(role) {
  if (role.includes("router")) return "routerNode";
  if (role.includes("distribution")) return "swdNode";
  if (role.includes("aggregation")) return "aggNode";
  if (role.includes("wireless")) return "wirelessBridgeNode";
  return "switchNode";
}

function formatUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Uses dagre's layered layout instead of a per-tier grid — a plain grid scattered a branch's devices far from their parent whenever multiple branches shared a tier, but dagre's ordering groups each branch and minimizes crossings.
// minlen is set to each edge's rank gap so skipped tiers (e.g. distribution straight to access) still land in the right row; same-rank edges (peer links) are excluded from dagre's graph entirely, since dagre throws on 0-length edges, so peers land side by side via their other edges instead of being stacked.
function layoutWithDagre(graphNodes, resolvedLinks, nodeWidths, rankById) {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: H_GAP, ranksep: V_GAP });
  g.setDefaultEdgeLabel(() => ({}));

  graphNodes.forEach((n) => {
    g.setNode(n.id, { width: nodeWidths[n.id] ?? NODE_W, height: NODE_H });
  });

  resolvedLinks.forEach((l) => {
    if (l.isPeer) return;
    const minlen = Math.max(1, rankById[l.childId] - rankById[l.parentId]);
    g.setEdge(l.parentId, l.childId, { minlen });
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

function normalizeRole(role) {
  return (role ?? "").toLowerCase().replace(/\s+/g, "_");
}

// Peer edges are excluded from dagre's ranking graph (see layoutWithDagre), so dagre can land same-rank peers far apart — recenter each pair side by side afterward, keeping dagre's computed rank (y).
function pullPeersTogether(positions, resolvedLinks, nodeWidths) {
  const adjusted = { ...positions };
  const seenPairs = new Set();
  resolvedLinks.forEach((l) => {
    if (!l.isPeer) return;
    const pairKey = [l.parentId, l.childId].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const aPos = adjusted[l.parentId];
    const bPos = adjusted[l.childId];
    if (!aPos || !bPos) return;
    const [leftId, rightId] = aPos.x <= bPos.x ? [l.parentId, l.childId] : [l.childId, l.parentId];
    const leftW = nodeWidths[leftId] ?? NODE_W;
    const rightW = nodeWidths[rightId] ?? NODE_W;
    const avgCenter = (adjusted[leftId].x + leftW / 2 + adjusted[rightId].x + rightW / 2) / 2;
    adjusted[leftId] = { ...adjusted[leftId], x: avgCenter - H_GAP / 2 - leftW };
    adjusted[rightId] = { ...adjusted[rightId], x: avgCenter + H_GAP / 2 };
  });
  return adjusted;
}

// Rank reflects real hop-distance from the core, not role-assumed depth — priority seeds a device at its own tier, then a bucket BFS lets its rank drop if there's a genuinely shorter path, so e.g. Aggregation with a direct router uplink isn't forced below Distribution.
// Seeding every tier independently (not just the lowest) also means a disconnected lowest-priority "root" device can't starve BFS propagation for the rest of the site.
function computeRank(graphNodes, adjacency) {
  const backbone = graphNodes.filter((n) => n.role !== "access" && typeof n.priority === "number");
  const distinctPriorities = [...new Set(backbone.map((n) => n.priority))].sort((a, b) => a - b);
  const tierByPriority = Object.fromEntries(distinctPriorities.map((p, i) => [p, i]));

  const rank = {};
  const buckets = [];
  const settle = (id, d) => {
    rank[id] = d;
    (buckets[d] ??= []).push(id);
  };

  backbone.forEach((n) => settle(n.id, tierByPriority[n.priority]));

  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d] ?? [];
    for (let i = 0; i < bucket.length; i++) {
      const cur = bucket[i];
      if (rank[cur] !== d) continue;
      (adjacency[cur] ?? []).forEach((nb) => {
        if (rank[nb] === undefined || d + 1 < rank[nb]) settle(nb, d + 1);
      });
    }
  }

  const bottomRank = distinctPriorities.length;
  graphNodes.forEach((n) => {
    if (rank[n.id] === undefined) rank[n.id] = bottomRank;
  });
  return rank;
}

export function buildSiteDiagramTopology(rawGraphNodes, graphLinks) {
  // Falls back through netbox_id/id/mist_id/name (devices without a Netbox record only have mist_id) so devices missing the preferred field don't collapse onto the same id and silently merge edges; stringified because React Flow's node id must be a string or the node silently fails to render.
  const graphNodes = (rawGraphNodes ?? []).map((n) => ({
    ...n,
    id: String(n.netbox_id ?? n.id ?? n.mist_id ?? n.name),
    role: normalizeRole(n.role),
  }));
  const nodeById = Object.fromEntries(graphNodes.map((n) => [n.id, n]));
  // The diagram API identifies link endpoints by device name rather than id.
  const idByName = Object.fromEntries(graphNodes.map((n) => [n.name, n.id]));
  // A neighbor's reported name doesn't always match the target node's name exactly (e.g. a clustered router's LLDP name carries a chassis-node suffix like "_node0") — resolve case-insensitively and retry with that suffix stripped.
  const idByLowerName = Object.fromEntries(graphNodes.map((n) => [n.name.toLowerCase(), n.id]));
  const resolveNeighborId = (neighborName) => {
    const lower = (neighborName ?? "").toLowerCase();
    return idByLowerName[lower] ?? idByLowerName[lower.replace(/_node\d+$/, "")];
  };

  // Every physical link is reported twice (once from each endpoint's LLDP table) — dedup by device+port pair, not just device pair, so legitimate parallel links (redundant fiber, LAG members) stay separate and only the mirrored source/target-swapped re-report collapses.
  const seenPairs = new Set();
  const uniqueLinks = [];
  const addUniqueLink = (l, aId, bId) => {
    if (!aId || !bId || aId === bId) return;
    const pairKey = [`${aId}:${l.source?.port ?? ""}`, `${bId}:${l.target?.port ?? ""}`].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    uniqueLinks.push({ ...l, aId, bId });
  };

  (graphLinks ?? []).forEach((l) => {
    addUniqueLink(l, idByName[l.source?.deviceName], idByName[l.target?.deviceName]);
  });

  // Fallback for links the API's `links` array missed entirely — sweep each device's raw `neighbors` list (the fuller per-device LLDP source) for resolvable peers; additive only, since the same device+port dedup key prevents duplicates.
  graphNodes.forEach((n) => {
    (n.neighbors ?? []).forEach((nb, idx) => {
      const otherId = resolveNeighborId(nb.name);
      if (!otherId) return;
      addUniqueLink(
        {
          id: `nb-${n.id}-${idx}`,
          source: { deviceName: n.name, port: nb.local_port },
          target: { deviceName: nodeById[otherId]?.name, port: nb.remote_port },
          medium: nb.media_type,
        },
        n.id,
        otherId,
      );
    });
  });

  const adjacency = {};
  graphNodes.forEach((n) => (adjacency[n.id] = []));
  uniqueLinks.forEach((l) => {
    adjacency[l.aId]?.push(l.bId);
    adjacency[l.bId]?.push(l.aId);
  });

  const rankById = computeRank(graphNodes, adjacency);

  // The API's source/target labeling doesn't reflect which side is upstream, so orient every link by rank instead (lower rank = parent); same-rank links (e.g. redundant peer links) aren't parent/child at all — flagged `isPeer` and rendered via side handles instead.
  const resolvedLinks = uniqueLinks.map((l) => {
    const rankGap = rankById[l.bId] - rankById[l.aId];
    if (rankGap === 0) {
      return { ...l, isPeer: true, parentId: l.aId, childId: l.bId, parentPort: l.source.port, childPort: l.target.port };
    }
    const bIsParent = rankGap < 0;
    return bIsParent
      ? { ...l, isPeer: false, parentId: l.bId, childId: l.aId, parentPort: l.target.port, childPort: l.source.port }
      : { ...l, isPeer: false, parentId: l.aId, childId: l.bId, parentPort: l.source.port, childPort: l.target.port };
  });

  // `childrenMap` dedupes children per parent (a second link to the same child is a wiring detail, not a second descendant) for collapse/expand and the hidden-count; `linksByParent`/`linksByChild` keep every individual link so redundant pairs still get separate fanned handle positions.
  const childrenMap = {};
  const linksByParent = {};
  const linksByChild = {};
  resolvedLinks.forEach((l) => {
    if (l.isPeer) return;
    const kids = (childrenMap[l.parentId] ??= []);
    if (!kids.includes(l.childId)) kids.push(l.childId);
    (linksByParent[l.parentId] ??= []).push(l);
    (linksByChild[l.childId] ??= []).push(l);
  });

  const peerNodeIds = new Set();
  resolvedLinks.forEach((l) => {
    if (!l.isPeer) return;
    peerNodeIds.add(l.parentId);
    peerNodeIds.add(l.childId);
  });

  const nodeWidths = {};
  graphNodes.forEach((n) => {
    const linkCount = (linksByParent[n.id] ?? []).length;
    nodeWidths[n.id] =
      linkCount <= 1
        ? NODE_W
        : Math.max(NODE_W, Math.ceil(((linkCount - 1) * 24) / 0.7) + 40);
  });

  const positions = pullPeersTogether(
    layoutWithDagre(graphNodes, resolvedLinks, nodeWidths, rankById),
    resolvedLinks,
    nodeWidths,
  );

  const nodeSourceHandles = {};
  Object.entries(linksByParent).forEach(([parentId, links]) => {
    const sorted = [...links].sort(
      (a, b) => (positions[a.childId]?.x ?? 0) - (positions[b.childId]?.x ?? 0),
    );
    const n = sorted.length;
    nodeSourceHandles[parentId] = sorted.map((l, idx) => ({
      id: `sh-${l.id}`,
      leftPct: n === 1 ? 50 : 15 + (idx / (n - 1)) * 70,
    }));
  });

  // A dual-homed node would otherwise have every incoming edge pinch into one fixed top-center target handle — spread target handles the same way source handles are, so each link gets its own attachment point.
  const nodeTargetHandles = {};
  Object.entries(linksByChild).forEach(([childId, links]) => {
    const sorted = [...links].sort(
      (a, b) => (positions[a.parentId]?.x ?? 0) - (positions[b.parentId]?.x ?? 0),
    );
    const n = sorted.length;
    nodeTargetHandles[childId] = sorted.map((l, idx) => ({
      id: `th-${l.id}`,
      leftPct: n === 1 ? 50 : 15 + (idx / (n - 1)) * 70,
    }));
  });

  const nodes = graphNodes.map((n) => ({
    id: n.id,
    type: nodeTypeForRole(n.role),
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
      targetHandles: nodeTargetHandles[n.id] ?? [],
      nodeWidth: nodeWidths[n.id] ?? NODE_W,
      hasPeer: peerNodeIds.has(n.id),
    },
  }));

  const edges = resolvedLinks.map((l) => {
    const isWireless = l.medium === "wireless";
    const color =
      l.status === "down"
        ? "#6b7280"
        : isWireless
          ? "#06b6d4"
          : l.medium === "fiber"
            ? "#f59e0b"
            : "#3b82f6";

    if (l.isPeer) {
      // Route peer links via side handles instead of top/bottom so a same-rank link doesn't arc through the hierarchy edges fanning out below every node.
      const aX = positions[l.parentId]?.x ?? 0;
      const bX = positions[l.childId]?.x ?? 0;
      const [leftId, rightId] = aX <= bX ? [l.parentId, l.childId] : [l.childId, l.parentId];
      const [leftPort, rightPort] = aX <= bX ? [l.parentPort, l.childPort] : [l.childPort, l.parentPort];
      return {
        id: l.id,
        source: leftId,
        target: rightId,
        sourceHandle: "peer-right-source",
        targetHandle: "peer-left-target",
        type: isWireless ? "wirelessEdge" : "hoverEdge",
        style: isWireless
          ? { stroke: color, strokeWidth: 2, strokeDasharray: "8 4" }
          : { stroke: color, strokeWidth: 2 },
        data: {
          parentPort: leftPort,
          childPort: rightPort,
          parentName: nodeById[leftId]?.name ?? leftId,
          childName: nodeById[rightId]?.name ?? rightId,
        },
      };
    }

    const parentId = l.parentId;
    const childId = l.childId;
    return {
      id: l.id,
      source: parentId,
      target: childId,
      sourceHandle: `sh-${l.id}`,
      targetHandle: `th-${l.id}`,
      type: isWireless ? "wirelessEdge" : "hoverEdge",
      style: isWireless
        ? { stroke: color, strokeWidth: 2, strokeDasharray: "8 4" }
        : { stroke: color, strokeWidth: 2 },
      markerEnd: { type: "arrowclosed", color },
      data: {
        parentPort: l.parentPort,
        childPort: l.childPort,
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
