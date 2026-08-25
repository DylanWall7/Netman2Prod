import React, { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// TODO(backend): no endpoint exists yet for per-scope lease/reservation listing, so both
// stay mocked from the scope's leases/reservations counts. Once a real endpoint shows up,
// this is the only place that needs to change — everything below (search, add, delete)
// already operates on plain arrays.
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

const EMPTY_RESERVATION = { ip: "", mac: "", hostname: "", description: "" };

export default function DHCPScopeModal({ scope, siteCode, initialTab, onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab ?? "leases");
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leaseSearch, setLeaseSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [leases, setLeases] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [addingReservation, setAddingReservation] = useState(false);
  const [newReservation, setNewReservation] = useState(EMPTY_RESERVATION);

  useEffect(() => {
    if (!scope) return;
    setLeases(buildMockLeases(scope.scopeId, scope.leases));
    setReservations(buildMockReservations(scope.scopeId, scope.reservations));
    setActiveTab(initialTab ?? "leases");
    setLeaseSearch("");
    setReservationSearch("");
    setAddingReservation(false);
    setNewReservation(EMPTY_RESERVATION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.id]);

  if (!scope) return null;

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
    setLeases(buildMockLeases(scope.scopeId, scope.leases));
    setLeasesLoading(false);
  };

  // TODO(backend): no create/delete-reservation endpoint exists yet — both are local-only
  // until one is available.
  const canSubmitReservation = newReservation.ip.trim() && newReservation.mac.trim();
  const handleAddReservation = (e) => {
    e.preventDefault();
    if (!canSubmitReservation) return;
    setReservations((prev) => [
      ...prev,
      {
        ip: newReservation.ip.trim(),
        mac: newReservation.mac.trim(),
        hostname: newReservation.hostname.trim() || "—",
        description: newReservation.description.trim() || "—",
      },
    ]);
    setNewReservation(EMPTY_RESERVATION);
    setAddingReservation(false);
  };

  const handleDeleteReservation = (index) =>
    setReservations((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-4xl max-h-full rounded-xl border border-zinc-700/60 bg-gray-900 shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-700/40 flex-shrink-0">
          <div>
            <p className="text-xs text-zinc-500 font-mono mb-0.5">{siteCode}</p>
            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              {scope.name}
            </h2>
            <p className="text-xs font-mono text-pink-400 mt-1">
              {scope.scopeId}/{scope.cidr} &mdash; gw {scope.gateway} &mdash; {scope.start} &rarr; {scope.end}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 border-b border-zinc-700/40 flex-shrink-0">
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
                {tab === "leases" ? leases.length : reservations.length}
              </span>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 overflow-y-auto">
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
                  {filteredLeases.length} of {leases.length} leases
                </span>
              </div>

              {leases.length === 0 ? (
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
                  <div className="divide-y divide-zinc-700/20 max-h-[360px] overflow-y-auto">
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
                <button
                  onClick={() => setAddingReservation((v) => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-pink-900/30 border border-pink-600/50 text-pink-300 hover:bg-pink-800/50 hover:text-white transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add reservation
                </button>
                <span className="text-xs text-zinc-400 ml-auto">
                  {filteredReservations.length} of {reservations.length} reservations
                </span>
              </div>

              {addingReservation && (
                <form
                  onSubmit={handleAddReservation}
                  className="mb-4 p-4 rounded-lg border border-zinc-700/50 bg-gray-800/40 grid grid-cols-2 gap-3"
                >
                  <p className="col-span-2 text-xs text-zinc-500 -mt-1 mb-1">
                    No create-reservation endpoint exists yet, so this is added locally only.
                  </p>
                  {[
                    ["ip", "IP address", "10.148.0.201"],
                    ["mac", "MAC address", "00:AA:BB:CC:DD:EE"],
                    ["hostname", "Hostname", "SRV-004"],
                    ["description", "Description", "optional"],
                  ].map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
                      <input
                        type="text"
                        value={newReservation[key]}
                        onChange={(e) =>
                          setNewReservation((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-900/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50"
                      />
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAddingReservation(false)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmitReservation}
                      className="text-xs px-3 py-1.5 rounded-lg bg-pink-600 text-black font-semibold hover:bg-pink-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {reservations.length === 0 ? (
                <p className="text-sm text-zinc-500 italic text-center py-10">
                  No reservations on this scope.
                </p>
              ) : (
                <div className="rounded-lg border border-zinc-700/40 overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] bg-gray-800/70 border-b border-zinc-700/40 px-4 py-2.5 text-xs uppercase tracking-wider text-zinc-300 font-semibold select-none">
                    <div>IP Address</div>
                    <div>MAC Address</div>
                    <div>Hostname</div>
                    <div>Description</div>
                    <div />
                  </div>
                  <div className="divide-y divide-zinc-700/20 max-h-[360px] overflow-y-auto">
                    {filteredReservations.length === 0 ? (
                      <div className="px-4 py-8 text-xs text-zinc-500 text-center italic">
                        No results match your search.
                      </div>
                    ) : (
                      filteredReservations.map((res, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] px-4 py-2.5 text-xs hover:bg-gray-800/40 transition-colors items-center"
                        >
                          <span className="font-mono text-gray-100">{res.ip}</span>
                          <span className="font-mono text-zinc-200">{res.mac}</span>
                          <span className="text-gray-100">{res.hostname}</span>
                          <span className="text-zinc-300">{res.description}</span>
                          <button
                            onClick={() => handleDeleteReservation(reservations.indexOf(res))}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors justify-self-end"
                            title="Delete reservation"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
}
