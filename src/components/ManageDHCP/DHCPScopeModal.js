import React, { useEffect, useRef, useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  // PlusIcon, // unused while Add reservation is commented out for this view-only push
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getGizmoLeases,
  getGizmoReservations,
  getKeaLeases,
  getReservationsForSubnet,
  useSiteDashboardToken,
} from "../SiteDashboard/siteDashboardApi";

// TODO(backend): no create/delete-reservation endpoint exists yet — both are local-only
// until one is available. Also currently unused: Add reservation is commented out
// for this view-only push (see EMPTY_RESERVATION below).
// const EMPTY_RESERVATION = { ip: "", mac: "", description: "" };

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500";

// Both real reservation shapes are now confirmed (2026-08-27). Gizmo:
// { ipAddress, scopeId, clientId, name, description } — clientId is already
// a readable dash-separated MAC (e.g. "6c-3b-e5-04-da-cd"). Kea: { ipAddress,
// hwAddress, hostname, usercontext: { description }, ... } — description
// lives nested under usercontext, not top-level. Neither source's
// name/hostname field is reliably a real hostname (Kea's is confirmed
// always ""), so it's dropped from the model entirely rather than shown as
// a column that's permanently blank.
function mapReservation(r, i) {
  return {
    ip: r.ipAddress ?? "—",
    mac: r.clientId ?? r.hwAddress ?? "—",
    description: (r.description || r.usercontext?.description || "").trim() || "—",
    _key: r.id ?? r.ipAddress ?? i,
  };
}

// Gizmo's real lease shape (confirmed 2026-08-27): { ipAddress, scopeId,
// clientId, hostName, addressState }. Kea's leasev4 (confirmed 2026-08-27):
// { ipAddress, hwAddress, hostname, state, cltt, validLft, subnetId,
// fqdnFwd, fqdnRev } — a real colon-formatted MAC in hwAddress, unlike
// Gizmo's encoded clientId. hostName/hostname can come back as "" (not
// missing), hence `||` instead of `??` there. Only Gizmo's addressState
// maps to `status` — Kea's `state` is an unconfirmed numeric code, not the
// same kind of value, so it's left out rather than guessed at.
function mapLease(l, i) {
  return {
    ip: l.ipAddress ?? l["ip-address"] ?? l.IPAddress ?? l.ip ?? "—",
    mac: l.hwAddress ?? l.clientId ?? l["hw-address"] ?? l.MacAddress ?? l.mac ?? "—",
    hostname: l.hostName || l.hostname || l.Name || l.name || "—",
    status: l.addressState ?? null,
    _key: l.id ?? l.ID ?? `${l.ipAddress ?? l["ip-address"] ?? l.ip ?? i}`,
  };
}

// Gizmo's leases endpoint returns a row for every reservation on the scope,
// not just real active dynamic leases — addressState (e.g.
// "InactiveReservation"/"ActiveReservation") is what tells them apart. Shown
// only for Gizmo so people don't mistake an unclaimed reservation for a real
// lease; trims the redundant "Reservation" suffix to read as a plain word.
function formatAddressState(status) {
  if (!status) return null;
  return status.replace(/Reservation$/, "") || status;
}

export default function DHCPScopeModal({ scope, siteCode, initialTab, onClose }) {
  const getToken = useSiteDashboardToken();
  const [activeTab, setActiveTab] = useState(initialTab ?? "leases");
  const [leaseSearch, setLeaseSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservations, setReservations] = useState([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState(null);
  const [leases, setLeases] = useState([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState(null);
  // Add-reservation is commented out along with its button/form below — this push is
  // view-only until scope management is built, and there's no create-reservation
  // endpoint yet anyway.
  // const [addingReservation, setAddingReservation] = useState(false);
  // const [newReservation, setNewReservation] = useState(EMPTY_RESERVATION);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // reservationv4 is a Kea-specific endpoint (same REST family as subnetv4) —
  // confirmed 2026-08-25 after it returned the *Kea* subnet's reservations
  // when queried for a Gizmo-only scope sharing the same address range.
  // Gizmo scopes now use their own dedicated /dhcp/gizmo/{id}/reservations
  // endpoint instead (keyed by gizmoId, not the subnet address).
  const loadReservations = async (currentScope) => {
    if (!currentScope?.hasGizmo && !currentScope?.hasKea) {
      setReservations([]);
      return;
    }
    setReservationsLoading(true);
    setReservationsError(null);
    try {
      const token = await getToken();
      if (!token) return; // falling back to a redirect — page is about to navigate away
      const data = currentScope.hasGizmo
        ? await getGizmoReservations(currentScope.gizmoId, token)
        : await getReservationsForSubnet(currentScope.scopeId, token);
      setReservations(data.map(mapReservation));
    } catch (err) {
      setReservationsError(err.message || "Failed to load reservations — please try again.");
    } finally {
      setReservationsLoading(false);
    }
  };

  const loadLeases = async (currentScope) => {
    if (!currentScope?.hasGizmo && !currentScope?.hasKea) {
      setLeases([]);
      return;
    }
    setLeasesLoading(true);
    setLeasesError(null);
    try {
      const token = await getToken();
      if (!token) return; // falling back to a redirect — page is about to navigate away
      const data = currentScope.hasGizmo
        ? await getGizmoLeases(currentScope.gizmoId, token)
        : await getKeaLeases(currentScope.scopeId, token);
      setLeases(data.map(mapLease));
    } catch (err) {
      setLeasesError(err.message || "Failed to load leases — please try again.");
    } finally {
      setLeasesLoading(false);
    }
  };

  useEffect(() => {
    if (!scope) return;
    setActiveTab(initialTab ?? "leases");
    setLeaseSearch("");
    setReservationSearch("");
    // setAddingReservation(false);
    // setNewReservation(EMPTY_RESERVATION);
    setReservations([]);
    setLeases([]);
    loadReservations(scope);
    loadLeases(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.id]);

  // Focus trap + Escape-to-close + focus restore. Runs whenever the modal opens/closes.
  useEffect(() => {
    if (!scope) return;
    previouslyFocusedRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const nodes = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.id]);

  if (!scope) return null;

  const filteredReservations = reservations.filter(
    (r) =>
      r.ip.includes(reservationSearch) ||
      r.mac.toLowerCase().includes(reservationSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(reservationSearch.toLowerCase())
  );

  const filteredLeases = leases.filter(
    (l) =>
      l.ip.includes(leaseSearch) ||
      l.mac.toLowerCase().includes(leaseSearch.toLowerCase()) ||
      l.hostname.toLowerCase().includes(leaseSearch.toLowerCase())
  );

  // const canSubmitReservation = newReservation.ip.trim() && newReservation.mac.trim();
  // const handleAddReservation = (e) => {
  //   e.preventDefault();
  //   if (!canSubmitReservation) return;
  //   setReservations((prev) => [
  //     ...prev,
  //     {
  //       ip: newReservation.ip.trim(),
  //       mac: newReservation.mac.trim(),
  //       description: newReservation.description.trim() || "—",
  //       _key: `local-${Date.now()}`,
  //     },
  //   ]);
  //   setNewReservation(EMPTY_RESERVATION);
  //   setAddingReservation(false);
  // };

  // Delete-reservation is disabled for now, pending a bit of testing on the
  // new Gizmo reservations/leases endpoints — the button is commented out
  // below rather than removed, so it's easy to re-enable.
  // const handleDeleteReservation = (index, ip) => {
  //   const confirmed = window.confirm(
  //     `Delete the reservation for ${ip}? This isn't wired to a real endpoint yet — it only removes it from this view.`
  //   );
  //   if (!confirmed) return;
  //   setReservations((prev) => prev.filter((_, i) => i !== index));
  // };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dhcp-scope-modal-title"
        className="w-full max-w-6xl max-h-full rounded-xl border border-zinc-700/60 bg-gray-900 shadow-xl flex flex-col overflow-hidden animate-modalIn motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-700/40 flex-shrink-0">
          <div>
            <p className="text-xs text-zinc-500 font-mono mb-0.5">{siteCode}</p>
            <h2 id="dhcp-scope-modal-title" className="text-lg font-bold text-pink-400">
              {scope.name}
            </h2>
            <p className="text-xs font-mono text-pink-400 mt-1">
              {scope.scopeId}/{scope.cidr} &mdash; gw {scope.gateway} &mdash; {scope.start} &rarr; {scope.end}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0 rounded ${FOCUS_RING}`}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div role="tablist" className="flex items-center gap-1 px-6 border-b border-zinc-700/40 flex-shrink-0">
          {["leases", "reservations"].map((tab) => (
            <button
              key={tab}
              role="tab"
              id={`dhcp-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls={`dhcp-tabpanel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${FOCUS_RING} ${
                activeTab === tab
                  ? "border-pink-500 text-pink-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
              {tab === "reservations" && (scope.hasGizmo || scope.hasKea) && (
                <span className="ml-2 text-xs font-mono opacity-70">{reservations.length}</span>
              )}
              {tab === "leases" && (scope.hasGizmo || scope.hasKea) && (
                <span className="ml-2 text-xs font-mono opacity-70">{leases.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {activeTab === "leases" && (
            <div role="tabpanel" id="dhcp-tabpanel-leases" aria-labelledby="dhcp-tab-leases">
              {!scope.hasGizmo && !scope.hasKea ? (
                <p className="text-sm text-zinc-500 italic text-center py-10">
                  This scope isn't deployed on Gizmo or Kea, so there's no lease data to show.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1 max-w-xs">
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        aria-label="Search leases by IP, MAC, or hostname"
                        placeholder="Search IP, MAC, hostname…"
                        value={leaseSearch}
                        onChange={(e) => setLeaseSearch(e.target.value)}
                        className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50 ${FOCUS_RING}`}
                      />
                    </div>
                    <button
                      onClick={() => loadLeases(scope)}
                      disabled={leasesLoading}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800/60 border border-zinc-700/50 text-zinc-300 hover:border-pink-500/40 hover:text-pink-400 transition-colors disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${leasesLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    <span className="text-xs text-zinc-400 ml-auto">
                      {filteredLeases.length} of {leases.length} leases
                    </span>
                  </div>

                  {leasesError && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-xs text-center">
                      {leasesError}
                    </div>
                  )}

                  {leasesLoading ? (
                    <p className="text-sm text-zinc-500 italic text-center py-10">Loading leases…</p>
                  ) : leases.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic text-center py-10">No active leases on this scope.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="rounded-lg border border-zinc-700/40 overflow-hidden min-w-[900px]">
                        <div
                          className={`grid gap-4 bg-gray-800/70 border-b border-zinc-700/40 px-4 py-2.5 text-xs uppercase tracking-wider text-zinc-300 font-semibold select-none ${
                            scope.hasGizmo ? "grid-cols-[0.8fr_1fr_1.4fr_0.8fr]" : "grid-cols-[0.8fr_1fr_1.8fr]"
                          }`}
                        >
                          <div>IP Address</div>
                          <div>MAC Address</div>
                          <div>Hostname</div>
                          {scope.hasGizmo && <div>Status</div>}
                        </div>
                        <div className="divide-y divide-zinc-700/20 max-h-[360px] overflow-y-auto">
                          {filteredLeases.length === 0 ? (
                            <div className="px-4 py-8 text-xs text-zinc-500 text-center italic">
                              No results match your search.
                            </div>
                          ) : (
                            filteredLeases.map((lease) => (
                              <div
                                key={lease._key}
                                className={`grid gap-4 px-4 py-2.5 text-xs hover:bg-gray-800/40 transition-colors items-center ${
                                  scope.hasGizmo
                                    ? "grid-cols-[0.8fr_1fr_1.4fr_0.8fr]"
                                    : "grid-cols-[0.8fr_1fr_1.8fr]"
                                }`}
                              >
                                <span className="font-mono text-gray-100">{lease.ip}</span>
                                <span className="font-mono text-zinc-200">{lease.mac}</span>
                                <span className="text-gray-100">{lease.hostname}</span>
                                {scope.hasGizmo && (
                                  <span className="text-zinc-400">{formatAddressState(lease.status) || "—"}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "reservations" && (
            <div role="tabpanel" id="dhcp-tabpanel-reservations" aria-labelledby="dhcp-tab-reservations">
              {!scope.hasGizmo && !scope.hasKea ? (
                <p className="text-sm text-zinc-500 italic text-center py-10">
                  This scope isn't deployed on Gizmo or Kea, so there's no reservation data to show.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1 max-w-xs">
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        aria-label="Search reservations by IP, MAC, or description"
                        placeholder="Search IP, MAC, description…"
                        value={reservationSearch}
                        onChange={(e) => setReservationSearch(e.target.value)}
                        className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50 ${FOCUS_RING}`}
                      />
                    </div>
                    <button
                      onClick={() => loadReservations(scope)}
                      disabled={reservationsLoading}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800/60 border border-zinc-700/50 text-zinc-300 hover:border-pink-500/40 hover:text-pink-400 transition-colors disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${reservationsLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    {/* Add reservation is disabled for this view-only push — see the commented-out
                        state/handlers above. Re-enable alongside scope management. */}
                    {/* <button
                      onClick={() => setAddingReservation((v) => !v)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-pink-600 text-black font-semibold hover:bg-pink-700 hover:text-pink-600 transition-colors ${FOCUS_RING}`}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add reservation
                    </button> */}
                    <span className="text-xs text-zinc-400 ml-auto">
                      {filteredReservations.length} of {reservations.length} reservations
                    </span>
                  </div>

                  {reservationsError && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-xs text-center">
                      {reservationsError}
                    </div>
                  )}

                  {/* {addingReservation && (
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
                        ["description", "Description", "optional"],
                      ].map(([key, label, placeholder]) => (
                        <div key={key}>
                          <label htmlFor={`reservation-${key}`} className="block text-xs text-zinc-400 mb-1">
                            {label}
                          </label>
                          <input
                            id={`reservation-${key}`}
                            type="text"
                            value={newReservation[key]}
                            onChange={(e) =>
                              setNewReservation((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={placeholder}
                            className={`w-full px-3 py-1.5 text-xs rounded-lg bg-gray-900/60 border border-zinc-700/50 text-gray-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50 ${FOCUS_RING}`}
                          />
                        </div>
                      ))}
                      <div className="col-span-2 flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setAddingReservation(false)}
                          className={`text-xs px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white transition-colors ${FOCUS_RING}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!canSubmitReservation}
                          className={`text-xs px-3 py-1.5 rounded-lg bg-pink-600 text-black font-semibold hover:bg-pink-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
                        >
                          Add
                        </button>
                      </div>
                    </form>
                  )} */}

                  {reservationsLoading ? (
                    <p className="text-sm text-zinc-500 italic text-center py-10">Loading reservations…</p>
                  ) : reservations.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic text-center py-10">
                      No reservations on this scope.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="rounded-lg border border-zinc-700/40 overflow-hidden min-w-[900px]">
                        <div className="grid grid-cols-[0.9fr_1fr_1.8fr_auto] gap-4 bg-gray-800/70 border-b border-zinc-700/40 px-4 py-2.5 text-xs uppercase tracking-wider text-zinc-300 font-semibold select-none">
                          <div>IP Address</div>
                          <div>MAC Address</div>
                          <div>Description</div>
                          <div />
                        </div>
                        <div className="divide-y divide-zinc-700/20 max-h-[360px] overflow-y-auto">
                          {filteredReservations.length === 0 ? (
                            <div className="px-4 py-8 text-xs text-zinc-500 text-center italic">
                              No results match your search.
                            </div>
                          ) : (
                            filteredReservations.map((res) => (
                              <div
                                key={res._key}
                                className="grid grid-cols-[0.9fr_1fr_1.8fr_auto] gap-4 px-4 py-2.5 text-xs hover:bg-gray-800/40 transition-colors items-center"
                              >
                                <span className="font-mono text-gray-100">{res.ip}</span>
                                <span className="font-mono text-zinc-200">{res.mac}</span>
                                <span className="text-zinc-300">{res.description}</span>
                                {/* Delete is disabled for now, pending a bit of testing on the
                                    new reservations endpoints — see handleDeleteReservation above. */}
                                {/* <button
                                  onClick={() => handleDeleteReservation(reservations.indexOf(res), res.ip)}
                                  aria-label={`Delete reservation for ${res.ip}`}
                                  className={`p-2 rounded text-zinc-500 hover:text-red-400 transition-colors justify-self-end ${FOCUS_RING}`}
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button> */}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
