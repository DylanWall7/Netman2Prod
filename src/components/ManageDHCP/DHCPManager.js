import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ServerIcon,
  GlobeAltIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import DHCPScopeModal from "./DHCPScopeModal";

// Scopes are provisioned in Netbox, not created ad hoc here — this page only reflects what
// Netbox already knows about (no manual "create scope" flow).
//
// TODO(backend): the real Kia scope endpoint (GET /api/provisioning/dhcp/{siteCode}, see
// getDhcpScopes in ../SiteDashboard/siteDashboardApi.js) only returns { id, subnet,
// sharedNetworkName } today — no status, gateway, dns, mask, or lease/reservation counts.
// Scopes below stay mocked until that endpoint is enriched (or a richer one is added), at
// which point loadScopes() is the only place that needs to change.
const buildMockKiaScopes = (site) => [
  {
    id: 1,
    scopeId: "10.148.0.0",
    mask: "255.255.252.0",
    cidr: 22,
    name: `${site} VLAN 1 - WIRED`,
    start: "10.148.0.50",
    end: "10.148.3.242",
    gateway: "10.148.0.1",
    dns: ["10.148.0.1", "10.251.12.189", "10.251.12.190"],
    domain: "kiewitplaza.com",
    leases: 14,
    reservations: 3,
    status: "active",
    expanded: false,
  },
  {
    id: 2,
    scopeId: "10.148.4.0",
    mask: "255.255.252.0",
    cidr: 22,
    name: `${site} VLAN 5 - WIRELESS`,
    start: "10.148.4.10",
    end: "10.148.7.242",
    gateway: "10.148.4.1",
    dns: ["10.148.4.1", "10.251.12.189", "10.251.12.190"],
    domain: "kiewitplaza.com",
    leases: 87,
    reservations: 0,
    status: "active",
    expanded: false,
  },
  {
    id: 3,
    scopeId: "10.148.8.0",
    mask: "255.255.252.0",
    cidr: 22,
    name: `${site} VLAN 9 - VOICE`,
    start: "10.148.8.10",
    end: "10.148.11.242",
    gateway: "10.148.8.1",
    dns: ["10.148.8.1", "10.251.12.189", "10.251.12.190"],
    domain: "kiewitplaza.com",
    leases: 6,
    reservations: 0,
    status: "warning",
    expanded: false,
  },
  {
    id: 4,
    scopeId: "10.148.12.0",
    mask: "255.255.254.0",
    cidr: 23,
    name: `${site} VLAN 13 - GUEST`,
    start: "10.148.12.10",
    end: "10.148.13.244",
    gateway: "10.148.12.1",
    dns: ["10.148.12.1", "10.251.12.189", "10.251.12.190"],
    domain: "kiewitplaza.com",
    leases: 2,
    reservations: 0,
    status: "active",
    expanded: false,
  },
];

const STATUS_STYLES = {
  active: { dot: "bg-green-400", badge: "bg-green-900/30 text-green-400 border-green-700/40", label: "Active" },
  warning: { dot: "bg-yellow-400", badge: "bg-yellow-900/30 text-yellow-400 border-yellow-700/40", label: "Warning" },
  error: { dot: "bg-red-400", badge: "bg-red-900/30 text-red-400 border-red-700/40", label: "Error" },
};

const ScopeCard = ({ scope, manageable, selected, onSelect, onExpand, onViewDetail }) => {
  const statusStyle = STATUS_STYLES[scope.status] || STATUS_STYLES.active;
  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden bg-gray-800/30">
      <div className="flex items-center gap-3 px-4 py-3">
        {manageable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="w-4 h-4 rounded accent-pink-500 flex-shrink-0 cursor-pointer"
          />
        )}

        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />

        <span className="font-mono text-sm font-semibold text-pink-400 flex-shrink-0">
          {scope.scopeId}/{scope.cidr}
        </span>

        <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">{scope.name}</span>

        <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 hidden sm:inline-block ${statusStyle.badge}`}>
          {statusStyle.label}
        </span>

        <span className="font-mono text-xs text-zinc-500 hidden lg:block flex-shrink-0">
          gw: {scope.gateway}
        </span>

        <div className="flex gap-2 text-xs flex-shrink-0">
          <button
            onClick={() => onViewDetail("leases")}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900/40 border border-blue-600/50 text-blue-200 hover:bg-blue-800/60 hover:text-white transition-colors"
            title="View leases"
          >
            <span className="text-blue-300">leases</span>
            <span className="font-semibold text-white">{scope.leases}</span>
          </button>
          <button
            onClick={() => onViewDetail("reservations")}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-900/40 border border-purple-600/50 text-purple-200 hover:bg-purple-800/60 hover:text-white transition-colors"
            title="View reservations"
          >
            <span className="text-purple-300">res</span>
            <span className="font-semibold text-white">{scope.reservations}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExpand}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Network details"
          >
            {scope.expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {scope.expanded && (
        <div className="border-t border-zinc-700/40 bg-[#081b2a] px-5 py-4">
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                <ServerIcon className="w-3.5 h-3.5" />
                Network
              </div>
              <div className="space-y-2.5">
                {[
                  ["Scope ID", scope.scopeId],
                  ["Mask", scope.mask],
                  ["Range", `${scope.start} → ${scope.end}`],
                  ["Gateway", scope.gateway],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-mono text-gray-100">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                <GlobeAltIcon className="w-3.5 h-3.5" />
                DNS & Domain
              </div>
              <div className="space-y-2.5">
                {scope.dns.map((d, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-zinc-500">DNS {i + 1}</span>
                    <span className="font-mono text-gray-100">{d}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t border-zinc-700/30 pt-2 mt-1">
                  <span className="text-zinc-500">Domain</span>
                  <span className="font-mono text-gray-100">{scope.domain}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const DHCPManager = () => {
  const navigate = useNavigate();
  const { siteCode } = useParams();

  const [scopesLoading, setScopesLoading] = useState(false);
  const [kiaScopes, setKiaScopes] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [activeScope, setActiveScope] = useState(null);
  const [activeTab, setActiveTab] = useState("leases");

  const loadScopes = async (site) => {
    setScopesLoading(true);
    setHasLoaded(false);
    setKiaScopes([]);
    setSelectedScopes([]);
    // TODO(backend): swap for getDhcpScopes(site, token).kia once the endpoint returns
    // enough fields (status, gateway, dns, leases/reservations counts) to drive this UI.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setKiaScopes(buildMockKiaScopes(site));
    setScopesLoading(false);
    setHasLoaded(true);
  };

  useEffect(() => {
    if (siteCode) loadScopes(siteCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode]);

  const toggleKiaExpand = (id) =>
    setKiaScopes((prev) => prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)));

  const toggleSelect = (id) =>
    setSelectedScopes((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedScopes(selectedScopes.length === kiaScopes.length ? [] : kiaScopes.map((s) => s.id));

  // TODO(backend): no single-scope DELETE endpoint is confirmed yet — only whole-site
  // deprovisioning (DELETE /api/deprovisioning/dhcp/{siteCode}) exists today. Wire this up
  // once a per-scope delete endpoint is available.
  const handleDeleteSelected = () => {
    setKiaScopes((prev) => prev.filter((s) => !selectedScopes.includes(s.id)));
    setSelectedScopes([]);
  };

  return (
    <div className="text-lg flex flex-col items-center">
      <div className="max-w-3xl mx-auto text-center mt-16 w-full px-4">
        <button
          onClick={() => navigate("/dhcp")}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-pink-400 transition-colors mb-4 mx-auto"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Change site
        </button>
        <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            DHCP Manager
          </span>
          <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-pink-400 mb-1 font-mono">{siteCode}</p>
        <p className="text-sm text-zinc-400">Kia DHCP scopes for this site.</p>
      </div>

      <div className="w-full max-w-5xl px-4 mt-10">
        {scopesLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse border border-zinc-700/20" />
            ))}
          </div>
        )}

        {!scopesLoading && hasLoaded && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={selectedScopes.length === kiaScopes.length && kiaScopes.length > 0}
                ref={(el) => {
                  if (el) el.indeterminate = selectedScopes.length > 0 && selectedScopes.length < kiaScopes.length;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded accent-pink-500 cursor-pointer"
              />
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
                Kia DHCP Server
              </span>

              {selectedScopes.length > 0 ? (
                <button
                  onClick={handleDeleteSelected}
                  className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Delete {selectedScopes.length} scope{selectedScopes.length > 1 ? "s" : ""}
                </button>
              ) : (
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/40">
                  Manageable
                </span>
              )}
            </div>

            <div className="space-y-2">
              {kiaScopes.length === 0 ? (
                <p className="text-sm text-zinc-500 italic py-4 text-center">
                  No Kia DHCP scopes found for {siteCode}.
                </p>
              ) : (
                kiaScopes.map((scope) => (
                  <ScopeCard
                    key={scope.id}
                    scope={scope}
                    manageable
                    selected={selectedScopes.includes(scope.id)}
                    onSelect={() => toggleSelect(scope.id)}
                    onExpand={() => toggleKiaExpand(scope.id)}
                    onViewDetail={(tab) => {
                      setActiveTab(tab);
                      setActiveScope(scope);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {!scopesLoading && !hasLoaded && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-5xl opacity-40">🖧</div>
            <p className="text-gray-400 text-sm max-w-sm">Loading DHCP scopes…</p>
          </div>
        )}
      </div>

      <DHCPScopeModal
        scope={activeScope}
        siteCode={siteCode}
        initialTab={activeTab}
        onClose={() => setActiveScope(null)}
      />
    </div>
  );
};

export default DHCPManager;
