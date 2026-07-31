import React, { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem, Select, SelectItem } from "@nextui-org/react";
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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { listSnapshots, getSnapshot, listNetboxSites, useNetworkSearchToken } from "./siteDiagramsApi";
import { buildSiteDiagramTopology, computeVisible, getDistinctLocations, NODE_W, NODE_H } from "./topologyBuild";

function HoverEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data, markerEnd }) {
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState(null);

  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const activeStyle = hovered
    ? { ...style, strokeWidth: 3, filter: `drop-shadow(0 0 5px ${style?.stroke ?? "#3b82f6"})` }
    : style;
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
        onMouseMove={(e) => setTipPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{ position: "absolute", transform: `translate(${tx + 8}px, ${ty - 20}px)`, pointerEvents: "none", zIndex: 1000 }}
            className="bg-gray-950 border border-gray-600 text-[11px] font-mono px-3 py-2 rounded shadow-xl space-y-1"
          >
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

function WirelessEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) {
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState(null);

  const style = { stroke: "#06b6d4", strokeWidth: 2, strokeDasharray: "8 4" };
  const activeStyle = hovered ? { ...style, strokeWidth: 3, filter: "drop-shadow(0 0 6px #06b6d4)" } : style;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
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
        onMouseMove={(e) => setTipPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{ position: "absolute", transform: `translate(${tx + 8}px, ${ty - 20}px)`, pointerEvents: "none", zIndex: 1000 }}
            className="bg-gray-950 border border-cyan-700 text-[11px] font-mono px-3 py-2 rounded shadow-xl space-y-1"
          >
            <div className="text-cyan-400 font-semibold text-[10px] uppercase tracking-wide">Wireless Bridge</div>
            <div className="text-gray-400 text-[10px]">
              {data?.parentName} → {data?.childName}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { hoverEdge: HoverEdge, wirelessEdge: WirelessEdge };

function DeviceNode({ data, selected, accentColor = "#3b82f6", dashed = false }) {
  const isOnline = data.status === "online";
  const nw = data.nodeWidth ?? NODE_W;
  const handles = data.sourceHandles ?? [];
  const glow = data.highlighted
    ? `0 0 0 2px ${accentColor}, 0 0 16px ${accentColor}88, 0 4px 20px rgba(0,0,0,.5)`
    : "0 4px 20px rgba(0,0,0,.5)";

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
        {data.ip && (
          <button
            onClick={() => navigator.clipboard.writeText(data.ip)}
            className="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-400 transition-colors font-mono"
          >
            Copy IP
          </button>
        )}
      </NodeToolbar>
      <div
        style={{
          border: `2px ${dashed ? "dashed" : "solid"} ${accentColor}`,
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
        <Handle type="target" position={Position.Top} style={{ background: accentColor, width: 8, height: 8 }} />
        {!data.isCollapsed && handles.length > 0 ? (
          handles.map((h) => (
            <Handle
              key={h.id}
              id={h.id}
              type="source"
              position={Position.Bottom}
              style={{ left: `${h.leftPct}%`, background: accentColor, width: 8, height: 8 }}
            />
          ))
        ) : (
          <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
        )}

        <div style={{ color: accentColor, fontWeight: 700, fontSize: 11, lineHeight: 1.3 }}>{data.name}</div>
        <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 6 }}>
          {data.vendor && <span className="uppercase tracking-wide">{data.vendor}</span>}
          {data.vendor && data.model ? " · " : ""}
          {data.model}
        </div>

        <div style={{ borderTop: "1px solid #374151", paddingTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            ["Status", isOnline ? "Online" : "Offline", isOnline ? "#4ade80" : "#f87171"],
            ["IP", data.ip || "—", "#d1d5db"],
            ["Version", data.version || "—", "#d1d5db"],
            ...(data.uptime ? [["Uptime", data.uptime, "#d1d5db"]] : []),
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, gap: 8 }}>
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

        {data.hiddenLinkCount > 0 && (
          <div className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-600 text-gray-300">
            🔗 {data.hiddenLinkCount} hidden
          </div>
        )}

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

const RouterNode = ({ data, selected }) => <DeviceNode data={data} selected={selected} accentColor="#ef4444" />;
const SwdNode = ({ data, selected }) => <DeviceNode data={data} selected={selected} accentColor="#a855f7" />;
const AggNode = ({ data, selected }) => <DeviceNode data={data} selected={selected} accentColor="#f97316" />;
const SwitchNode = ({ data, selected }) => <DeviceNode data={data} selected={selected} accentColor="#3b82f6" />;
const WirelessBridgeNode = ({ data, selected }) => <DeviceNode data={data} selected={selected} accentColor="#06b6d4" dashed />;

const nodeTypes = {
  routerNode: RouterNode,
  swdNode: SwdNode,
  aggNode: AggNode,
  switchNode: SwitchNode,
  wirelessBridgeNode: WirelessBridgeNode,
};

const EMPTY_RAW = { nodes: [], edges: [], childrenMap: {} };

export default function SiteDiagramsView() {
  const getToken = useNetworkSearchToken();

  const [sites, setSites] = useState([]);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [selectedSite, setSelectedSite] = useState(null);
  const [error, setError] = useState(null);

  const [snapshots, setSnapshots] = useState([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [isLoadingSnapshotDetail, setIsLoadingSnapshotDetail] = useState(false);
  const latestSnapshotRequestRef = useRef(null);

  const [rawData, setRawData] = useState(EMPTY_RAW);
  const [allLocations, setAllLocations] = useState([]);
  const [selectedLocationKeys, setSelectedLocationKeys] = useState(new Set());
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [searchText, setSearchText] = useState("");
  const [rfInstance, setRfInstance] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingSites(true);
      setError(null);
      try {
        const token = await getToken();
        const data = await listNetboxSites(token);
        if (!cancelled) setSites(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load sites");
      } finally {
        if (!cancelled) setIsLoadingSites(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSite) return;
    let cancelled = false;
    setIsLoadingSnapshots(true);
    setError(null);
    setSnapshots([]);
    setSelectedSnapshotId(null);
    setRawData(EMPTY_RAW);
    setAllLocations([]);
    setSelectedLocationKeys(new Set());
    setCollapsedIds(new Set());
    (async () => {
      try {
        const data = await listSnapshots(selectedSite.id);
        if (!cancelled) setSnapshots(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load snapshots");
      } finally {
        if (!cancelled) setIsLoadingSnapshots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSite]);

  const handleSelectSnapshot = useCallback(
    async (snapshotId) => {
      setSelectedSnapshotId(snapshotId);
      setIsLoadingSnapshotDetail(true);
      setError(null);
      latestSnapshotRequestRef.current = snapshotId;
      try {
        const detail = await getSnapshot(selectedSite.id, snapshotId);
        if (latestSnapshotRequestRef.current !== snapshotId) return;
        const { nodes: n, edges: e, childrenMap: cm } = buildSiteDiagramTopology(detail.nodes, detail.links);
        const locations = getDistinctLocations(detail.nodes);
        setRawData({ nodes: n, edges: e, childrenMap: cm });
        setAllLocations(locations);
        setSelectedLocationKeys(new Set(locations));
        setCollapsedIds(new Set());
      } catch (err) {
        if (latestSnapshotRequestRef.current === snapshotId) setError(err.message || "Failed to load snapshot");
      } finally {
        if (latestSnapshotRequestRef.current === snapshotId) setIsLoadingSnapshotDetail(false);
      }
    },
    [selectedSite],
  );

  useEffect(() => {
    if (!rawData.nodes.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const hiddenLocations = new Set(allLocations.filter((loc) => !selectedLocationKeys.has(loc)));
    const { visibleNodes, visibleEdges } = computeVisible(
      rawData.nodes,
      rawData.edges,
      collapsedIds,
      rawData.childrenMap,
      hiddenLocations,
    );
    setNodes((prev) => {
      const posMap = Object.fromEntries(prev.map((n) => [n.id, n.position]));
      return visibleNodes.map((n) => ({ ...n, position: posMap[n.id] ?? n.position }));
    });
    setEdges(visibleEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, collapsedIds, allLocations, selectedLocationKeys]);

  const onEdgeMouseEnter = useCallback(
    (_, edge) => {
      setNodes((prev) =>
        prev.map((n) => ({ ...n, data: { ...n.data, highlighted: n.id === edge.source || n.id === edge.target } })),
      );
    },
    [setNodes],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, highlighted: false } })));
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

  const isCollapsible = rawData.nodes.some((n) => (rawData.childrenMap[n.id] ?? []).length > 0);

  const handleSearch = useCallback(
    (text) => {
      if (!rfInstance || !text.trim()) return;
      const match = nodes.find((n) => (n.data.name ?? "").toLowerCase().includes(text.trim().toLowerCase()));
      if (!match) return;
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
        if ([...ancestors].every((a) => !prev.has(a))) return prev;
        const next = new Set(prev);
        ancestors.forEach((a) => next.delete(a));
        return next;
      });
      setTimeout(() => {
        rfInstance.setCenter(match.position.x + NODE_W / 2, match.position.y + NODE_H / 2, { zoom: 1.8, duration: 600 });
        setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === match.id })));
      }, 50);
    },
    [rfInstance, nodes, rawData, setNodes],
  );

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => {
    const next = new Set();
    rawData.nodes.forEach((n) => {
      if ((rawData.childrenMap[n.id] ?? []).length > 0) next.add(n.id);
    });
    setCollapsedIds(next);
  }, [rawData]);

  return (
    <div className="p-6 text-gray-100">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative inline-block">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">Site Diagrams</span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-pink-400">Browse historical topology snapshots by site</p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {sidebarCollapsed ? (
          <button
            onClick={() => setSidebarCollapsed(false)}
            title="Show site, snapshot, and location filters"
            className="shrink-0 h-10 w-8 flex items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            »
          </button>
        ) : (
        <div className="w-64 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</h2>
            <button
              onClick={() => setSidebarCollapsed(true)}
              title="Hide filters to see more of the canvas"
              className="text-[11px] text-gray-500 hover:text-white transition-colors"
            >
              « Hide
            </button>
          </div>
          <Autocomplete
            size="sm"
            label="Site"
            menuTrigger="input"
            placeholder="Search sites…"
            className="dark"
            variant="bordered"
            isLoading={isLoadingSites}
            selectedKey={selectedSite ? String(selectedSite.id) : null}
            onSelectionChange={(key) => {
              const site = sites.find((s) => String(s.id) === key);
              if (site) setSelectedSite(site);
            }}
          >
            {sites.map((site) => (
              <AutocompleteItem key={String(site.id)} value={String(site.id)}>
                {site.name}
              </AutocompleteItem>
            ))}
          </Autocomplete>

          {selectedSite && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Snapshots</h2>
              {isLoadingSnapshots ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : snapshots.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No snapshots for this site.</p>
              ) : (
                <div className="space-y-1">
                  {snapshots.map((snap) => {
                    const isActive = snap.id === selectedSnapshotId;
                    return (
                      <button
                        key={snap.id}
                        onClick={() => handleSelectSnapshot(snap.id)}
                        className={`w-full text-left text-xs px-3 py-2 rounded border transition-colors ${
                          isActive
                            ? "bg-pink-500/20 border-pink-500 text-pink-200"
                            : "bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {new Date(snap.takenAt).toLocaleString()}
                        {isActive && isLoadingSnapshotDetail && <span className="ml-2 text-gray-500">loading…</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {allLocations.length > 0 && (
            <Select
              size="sm"
              label="Locations"
              placeholder="All locations"
              selectionMode="multiple"
              className="dark"
              variant="bordered"
              selectedKeys={selectedLocationKeys}
              onSelectionChange={(keys) => setSelectedLocationKeys(new Set(keys))}
            >
              {allLocations.map((loc) => (
                <SelectItem key={loc}>{loc}</SelectItem>
              ))}
            </Select>
          )}
        </div>
        )}

        <div className="flex-1 min-w-0">
          {nodes.length > 0 && (
            <div className="flex items-center justify-between mb-2 px-1 gap-3">
              <p className="text-xs text-gray-500 shrink-0">
                {rawData.nodes.length} device{rawData.nodes.length !== 1 ? "s" : ""} in snapshot
                {collapsedIds.size > 0 && (
                  <span className="text-blue-400 ml-2">
                    ({collapsedIds.size} node{collapsedIds.size !== 1 ? "s" : ""} collapsed)
                  </span>
                )}
              </p>
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
          )}

          <div style={{ height: "72vh" }} className="rounded-xl border border-gray-700 overflow-hidden">
            {isLoadingSnapshotDetail && rawData.nodes.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <span className="w-6 h-6 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
              </div>
            ) : !selectedSite ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-600 text-sm">Select a site to get started</p>
              </div>
            ) : !selectedSnapshotId ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-600 text-sm">Select a snapshot to view its topology</p>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-500 text-sm">No devices in this snapshot.</p>
              </div>
            ) : (
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
                colorMode="dark"
                style={{ "--xy-background-color": "transparent" }}
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
                          : n.type === "wirelessBridgeNode"
                            ? "#06b6d4"
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
                    <span className="text-purple-400">Purple = distribution</span>
                    <span className="text-orange-400">Orange = aggregation</span>
                    <span className="text-blue-400">Blue = access</span>
                    <span className="text-cyan-400">Cyan dashed = wireless bridge</span>
                  </div>
                </Panel>
              </ReactFlow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
