import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

const buildMockLeases = (scopeId, count) =>
  Array.from({ length: count }, (_, i) => {
    const base = scopeId.split(".").slice(0, 3).join(".");
    const expires = new Date(Date.now() + ((i * 3_600_000) % 86_400_000));
    return {
      ip: `${base}.${50 + i}`,
      mac: `00:1A:2B:${String(i % 256).padStart(2, "0")}:EF:${String((i * 7) % 256).padStart(2, "0")}`,
      hostname: `PC-${String(i + 1).padStart(3, "0")}`,
      expiry: expires.toLocaleTimeString(),
    };
  });

const buildMockReservations = (scopeId, count) =>
  Array.from({ length: count }, (_, i) => {
    const base = scopeId.split(".").slice(0, 3).join(".");
    return {
      ip: `${base}.${200 + i}`,
      mac: `00:AA:BB:${String(i % 256).padStart(2, "0")}:CC:${String((i * 3) % 256).padStart(2, "0")}`,
      hostname: `SRV-${String(i + 1).padStart(3, "0")}`,
      description: i === 0 ? "Default Gateway" : `Reserved host ${i + 1}`,
    };
  });

export default function DHCPScopeDetail() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const scope = state?.scope;
  const siteCode = state?.siteCode ?? "";
  const [activeTab, setActiveTab] = useState(state?.initialTab ?? "leases");
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leaseSearch, setLeaseSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");

  if (!scope) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-zinc-400 text-sm">No scope data. Please go back and select a scope.</p>
        <button
          onClick={() => navigate("/dhcpmanager")}
          className="flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-300 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to DHCP Manager
        </button>
      </div>
    );
  }

  const leases = buildMockLeases(scope.scopeId, scope.leases);
  const reservations = buildMockReservations(scope.scopeId, scope.reservations);

  const filteredLeases = leases.filter(
    (l) =>
      l.ip.includes(leaseSearch) ||
      l.mac.toLowerCase().includes(leaseSearch.toLowerCase()) ||
      l.hostname.toLowerCase().includes(leaseSearch.toLowerCase())
  );

  const filteredReservations = reservations.filter(
    (r) =>
      r.ip.includes(reservationSearch) ||
      r.mac.toLowerCase().includes(reservationSearch.toLowerCase()) ||
      r.hostname.toLowerCase().includes(reservationSearch.toLowerCase())
  );

  const handleRefresh = async () => {
    setLeasesLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLeasesLoading(false);
  };

  return (
    <div className="text-lg flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 mt-10">
        <button
          onClick={() =>
            navigate("/dhcpmanager", {
              state: {
                siteCode,
                kiaScopes: state?.kiaScopes,
                gizmoScopes: state?.gizmoScopes,
              },
            })
          }
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-pink-400 transition-colors mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to scopes
        </button>

        <div className="mb-6">
          <p className="text-xs text-zinc-500 font-mono mb-0.5">{siteCode}</p>
          <h1 className="text-3xl font-bold leading-tight mb-1 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              {scope.name}
            </span>
            <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-pink-500" />
          </h1>
          <p className="text-xs font-mono text-pink-400 mt-2">
            {scope.scopeId}/{scope.cidr} &mdash; gw {scope.gateway} &mdash; {scope.start} &rarr; {scope.end}
          </p>
        </div>

        <div className="flex items-center gap-1 mb-5 border-b border-zinc-700/40">
          {["leases", "reservations"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-pink-500 text-pink-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
              <span className="ml-2 text-xs font-mono opacity-70">
                {tab === "leases" ? scope.leases : scope.reservations}
              </span>
            </button>
          ))}
        </div>

        {activeTab === "leases" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search IP, MAC, hostname…"
                  value={leaseSearch}
                  onChange={(e) => setLeaseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={leasesLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800/60 border border-zinc-700/50 text-zinc-300 hover:border-pink-500/40 hover:text-pink-400 transition-colors disabled:opacity-40"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${leasesLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <span className="text-xs text-zinc-400 ml-auto">
                {filteredLeases.length} of {scope.leases} leases
              </span>
            </div>

            {scope.leases === 0 ? (
              <p className="text-sm text-zinc-500 italic text-center py-10">
                No active leases on this scope.
              </p>
            ) : (
              <div className="rounded-lg border border-zinc-700/40 overflow-hidden">
                <div className="grid grid-cols-4 bg-gray-800/70 border-b border-zinc-700/40 px-4 py-2.5 text-xs uppercase tracking-wider text-zinc-300 font-semibold select-none">
                  <div>IP Address</div>
                  <div>MAC Address</div>
                  <div>Hostname</div>
                  <div>Expires</div>
                </div>
                <div className="divide-y divide-zinc-700/20 max-h-[520px] overflow-y-auto">
                  {filteredLeases.length === 0 ? (
                    <div className="px-4 py-8 text-xs text-zinc-500 text-center italic">
                      No results match your search.
                    </div>
                  ) : (
                    filteredLeases.map((lease, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-4 px-4 py-2.5 text-xs hover:bg-gray-800/40 transition-colors"
                      >
                        <span className="font-mono text-gray-100">{lease.ip}</span>
                        <span className="font-mono text-zinc-200">{lease.mac}</span>
                        <span className="text-gray-100">{lease.hostname}</span>
                        <span className="text-zinc-300">{lease.expiry}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "reservations" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search IP, MAC, hostname…"
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <span className="text-xs text-zinc-400 ml-auto">
                {filteredReservations.length} of {scope.reservations} reservations
              </span>
            </div>

            {scope.reservations === 0 ? (
              <p className="text-sm text-zinc-500 italic text-center py-10">
                No reservations on this scope.
              </p>
            ) : (
              <div className="rounded-lg border border-zinc-700/40 overflow-hidden">
                <div className="grid grid-cols-4 bg-gray-800/70 border-b border-zinc-700/40 px-4 py-2.5 text-xs uppercase tracking-wider text-zinc-300 font-semibold select-none">
                  <div>IP Address</div>
                  <div>MAC Address</div>
                  <div>Hostname</div>
                  <div>Description</div>
                </div>
                <div className="divide-y divide-zinc-700/20 max-h-[520px] overflow-y-auto">
                  {filteredReservations.length === 0 ? (
                    <div className="px-4 py-8 text-xs text-zinc-500 text-center italic">
                      No results match your search.
                    </div>
                  ) : (
                    filteredReservations.map((res, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-4 px-4 py-2.5 text-xs hover:bg-gray-800/40 transition-colors"
                      >
                        <span className="font-mono text-gray-100">{res.ip}</span>
                        <span className="font-mono text-zinc-200">{res.mac}</span>
                        <span className="text-gray-100">{res.hostname}</span>
                        <span className="text-zinc-300">{res.description}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
