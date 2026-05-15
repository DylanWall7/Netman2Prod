import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ServerIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";

const MOCK_SITES = [
  "EASNY135",
  "KCONE001",
  "MNMSP042",
  "TXDAL078",
  "CALAS015",
  "FLMIA033",
  "WASEA091",
  "CODIN007",
  "AZPHO022",
  "GAATL055",
];

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
    expanded: false,
  },
];

const buildMockGizmoScopes = (site) => [
  {
    id: 101,
    scopeId: "172.20.0.0",
    mask: "255.255.255.0",
    cidr: 24,
    name: `${site} MGMT - OOB`,
    start: "172.20.0.10",
    end: "172.20.0.254",
    gateway: "172.20.0.1",
    dns: ["172.20.0.1"],
    domain: "kiewitplaza.com",
    leases: 4,
    reservations: 4,
    expanded: false,
  },
  {
    id: 102,
    scopeId: "192.168.100.0",
    mask: "255.255.255.128",
    cidr: 25,
    name: `${site} MGMT - INFRA`,
    start: "192.168.100.10",
    end: "192.168.100.126",
    gateway: "192.168.100.1",
    dns: ["192.168.100.1", "10.251.12.189"],
    domain: "kiewitplaza.com",
    leases: 11,
    reservations: 2,
    expanded: false,
  },
];

const ScopeCard = ({
  scope,
  manageable,
  selected,
  onSelect,
  onExpand,
  onViewDetail,
}) => (
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

      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />

      <span className="font-mono text-sm font-semibold text-pink-400 flex-shrink-0">
        {scope.scopeId}/{scope.cidr}
      </span>

      <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">
        {scope.name}
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
          {scope.expanded ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
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

// ---------------------------------------------------------------------------

const DHCPManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredState = location.state;
  const [siteCode, setSiteCode] = useState(restoredState?.siteCode ?? "");
  const [scopesLoading, setScopesLoading] = useState(false);
  const [kiaScopes, setKiaScopes] = useState(restoredState?.kiaScopes ?? []);
  const [gizmoScopes, setGizmoScopes] = useState(restoredState?.gizmoScopes ?? []);
  const [hasLoaded, setHasLoaded] = useState(!!(restoredState?.kiaScopes?.length || restoredState?.gizmoScopes?.length));
  const [selectedScopes, setSelectedScopes] = useState([]);

  const loadScopes = async (site) => {
    setScopesLoading(true);
    setHasLoaded(false);
    setKiaScopes([]);
    setGizmoScopes([]);
    setSelectedScopes([]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setKiaScopes(buildMockKiaScopes(site));
    setGizmoScopes(buildMockGizmoScopes(site));
    setScopesLoading(false);
    setHasLoaded(true);
  };

  const toggleKiaExpand = (id) =>
    setKiaScopes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)),
    );

  const toggleGizmoExpand = (id) =>
    setGizmoScopes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)),
    );

  const toggleSelect = (id) =>
    setSelectedScopes((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );

  const toggleSelectAll = () =>
    setSelectedScopes(
      selectedScopes.length === kiaScopes.length
        ? []
        : kiaScopes.map((s) => s.id),
    );

  const handleDeleteSelected = () =>
    setKiaScopes((prev) => prev.filter((s) => !selectedScopes.includes(s.id)));

  return (
    <div className="text-lg flex flex-col items-center">
      <div className="max-w-3xl mx-auto text-center mt-16">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            DHCP Manager
          </span>
          <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-pink-400 mb-8">
          View and manage DHCP scopes.
        </p>
        <div className="dark text-foreground flex justify-center">
          <Autocomplete
            size="sm"
            label="Site Code"
            menuTrigger="input"
            placeholder="Site Code"
            className="max-w-sm text-pink-400"
            variant="bordered"
            defaultSelectedKey={siteCode || undefined}
            onSelectionChange={(key) => {
              setSiteCode(key ?? "");
              if (key) loadScopes(key);
            }}
            onInputChange={(value) => {
              if (!value) {
                setSiteCode("");
                setKiaScopes([]);
                setGizmoScopes([]);
                setHasLoaded(false);
                setSelectedScopes([]);
              }
            }}
          >
            {MOCK_SITES.map((site) => (
              <AutocompleteItem key={site} value={site}>
                {site}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
      </div>

      <div className="w-full max-w-5xl px-4 mt-10">
        {scopesLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-gray-800/50 rounded-lg animate-pulse border border-zinc-700/20"
              />
            ))}
          </div>
        )}

        {!scopesLoading && hasLoaded && (
          <div className="space-y-10">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={
                    selectedScopes.length === kiaScopes.length &&
                    kiaScopes.length > 0
                  }
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        selectedScopes.length > 0 &&
                        selectedScopes.length < kiaScopes.length;
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
                    onClick={() => {
                      handleDeleteSelected();
                      setSelectedScopes([]);
                    }}
                    className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60 transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    Delete {selectedScopes.length} scope
                    {selectedScopes.length > 1 ? "s" : ""}
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
                      onViewDetail={(tab) =>
                        navigate("/dhcpmanager/scope", {
                          state: { scope, siteCode, initialTab: tab, kiaScopes, gizmoScopes },
                        })
                      }
                    />
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-zinc-500 flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Gizmo DHCP Server
                </span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40 flex items-center gap-1">
                  <LockClosedIcon className="w-3 h-3" />
                  Read Only
                </span>
              </div>
              <div className="space-y-2">
                {gizmoScopes.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic py-4 text-center">
                    No Gizmo DHCP scopes found for {siteCode}.
                  </p>
                ) : (
                  gizmoScopes.map((scope) => (
                    <ScopeCard
                      key={scope.id}
                      scope={scope}
                      manageable={false}
                      selected={false}
                      onSelect={() => {}}
                      onExpand={() => toggleGizmoExpand(scope.id)}
                      onViewDetail={(tab) =>
                        navigate("/dhcpmanager/scope", {
                          state: { scope, siteCode, initialTab: tab, kiaScopes, gizmoScopes },
                        })
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!scopesLoading && !hasLoaded && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-5xl opacity-40">🖧</div>
            <p className="text-gray-400 text-sm max-w-sm">
              Select a site to view its DHCP scopes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DHCPManager;
