import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { ChevronDownIcon, ChevronUpIcon, ServerIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import DHCPScopeModal from "./DHCPScopeModal";
import { getScopesForSite, listSites, useSiteDashboardToken } from "../SiteDashboard/siteDashboardApi";
import Badge from "../DepotOrders/Badge";

// Scopes are provisioned in Netbox, not created ad hoc here — this page only reflects what
// Netbox, Gizmo, and Kea already know about (no manual "create scope" flow).

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500";

const STATUS_STYLES = {
  active: { dot: "bg-green-400", color: "green", label: "Active" },
  // Gizmo's own state field is confirmed to include "Inactive", not just
  // "Active" — a real, meaningful state, not a fallback bucket.
  inactive: { dot: "bg-gray-500", color: "gray", label: "Inactive" },
  warning: { dot: "bg-yellow-400", color: "amber", label: "Warning" },
  error: { dot: "bg-red-400", color: "red", label: "Error" },
  unknown: { dot: "bg-gray-500", color: "gray", label: "Status unknown" },
  // A prefix that exists in Netbox but has no matching Gizmo or Kea record —
  // confirmed as a real, common case via a real sitesummary response,
  // 2026-08-25. Distinct from "unknown": we know exactly what this means.
  not_deployed: { dot: "bg-gray-600", color: "gray", label: "Not deployed" },
};

function ipToInt(ip) {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return parts.reduce((acc, p) => acc * 256 + p, 0);
}

// Fallback only — the API now returns a real `utilization` value derived
// server-side from Gizmo's percentageUsed or Kea's allocated/total addresses
// (see getScopesForSite). This client-side estimate from the scope's own
// start/end range only kicks in if that field is ever missing.
function utilizationPercent(scope) {
  const start = ipToInt(scope.start);
  const end = ipToInt(scope.end);
  if (start === null || end === null || end < start) return null;
  const poolSize = end - start + 1;
  if (poolSize <= 0) return null;
  return Math.min(100, Math.round((scope.leases / poolSize) * 100));
}

// Whether this scope's subnet has a matching Netbox prefix record at all —
// independent of the scope's own Active/Inactive status. Gizmo/Kea scopes
// can exist without ever being registered in Netbox, which is a real data-
// integrity gap worth flagging on its own, not something "Active" already
// covers (Netbox's prefix status describes the prefix record, not whether
// the scope is serving DHCP — see the status comment in buildScopeRow).
function NetboxMark({ hasNetbox }) {
  return (
    <span
      className={`hidden sm:inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border ${
        hasNetbox
          ? "bg-green-900/20 border-green-700/40 text-green-400"
          : "bg-red-900/20 border-red-700/40 text-red-400"
      }`}
      title={hasNetbox ? "Registered in Netbox" : "Not found in Netbox"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${hasNetbox ? "bg-green-400" : "bg-red-400"}`} />
      Netbox
    </span>
  );
}

// Each scope row now represents exactly one server's deployment — a subnet
// on both Gizmo and Kea produces two separate rows (see getScopesForSite),
// not one row with both flags set. Returns null for a not-deployed scope,
// since that's already conveyed by its status badge.
function sourceLabel(scope) {
  if (scope.hasGizmo) return "Gizmo";
  if (scope.hasKea) return "Kea";
  return null;
}

// The fill sweeps from 0 on mount, and its color continuously interpolates
// green->red via a browser-animatable custom property (@property --dhcp-hue,
// registered in index.css) instead of snapping between fixed color stops.
function CapacityBar({ percent }) {
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayPercent(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  const hue = 142 - 1.42 * displayPercent; // 142 (green) -> 0 (red) as percent climbs

  return (
    <div
      className="flex items-center gap-1.5"
      title="Leases used vs. this scope's own address range"
    >
      <div className="w-12 h-1.5 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full transition-[width,--dhcp-hue] duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${displayPercent}%`,
            "--dhcp-hue": hue,
            backgroundColor: "hsl(var(--dhcp-hue) 70% 50%)",
          }}
        />
      </div>
      <span className="font-mono text-xs text-zinc-400">{percent}%</span>
    </div>
  );
}

// "Active" is the unremarkable default (and the only state Gizmo ever reports
// besides "Inactive") and "unknown" just means no status data exists at all
// (true for every Kea scope) — neither is worth a badge. Only surface a
// status when it says something: Gizmo's real "Inactive", or warning/error/
// not_deployed.
const QUIET_STATUSES = new Set(["active", "unknown"]);

const ScopeCard = ({ scope, manageable, selected, onSelect, onExpand, onViewDetail }) => {
  const statusStyle = STATUS_STYLES[scope.status] || STATUS_STYLES.unknown;
  const showStatus = !QUIET_STATUSES.has(scope.status);
  const utilization = scope.utilization ?? utilizationPercent(scope);
  const source = sourceLabel(scope);
  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden bg-gray-800/30">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Identity cluster: what this row IS */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* This push is view-only — selection/bulk-management is disabled until that
              capability is built. Commented out, not removed, so it's a quick re-enable. */}
          {/* {manageable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              aria-label={`Select scope ${scope.scopeId}/${scope.cidr}`}
              className={`w-4 h-4 rounded accent-pink-500 cursor-pointer ${FOCUS_RING}`}
            />
          )} */}
          {showStatus && (
            <>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
              <span className="sr-only">{statusStyle.label}</span>
            </>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-mono text-sm font-bold text-pink-400 truncate">
            {scope.scopeId}/{scope.cidr}
          </span>
          <span className="text-xs uppercase tracking-wide text-pink-400 truncate">{scope.name}</span>
        </div>

        {/* Metadata cluster: supporting context, each with its own breakpoint */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {showStatus && (
            <span className="hidden sm:inline-block">
              <Badge color={statusStyle.color}>{statusStyle.label}</Badge>
            </span>
          )}

          {source && (
            <span className="hidden sm:inline-block font-mono text-xs uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
              {source}
            </span>
          )}

          <NetboxMark hasNetbox={scope.hasNetbox} />

          <span className="font-mono text-xs text-zinc-500 hidden lg:block">
            gw: {scope.gateway}
          </span>

          {utilization !== null && (
            <div className="hidden md:block">
              <CapacityBar percent={utilization} />
            </div>
          )}
        </div>

        {/* Actions cluster */}
        <div className="flex gap-2 text-xs flex-shrink-0">
          <button
            onClick={() => onViewDetail("leases")}
            aria-label={`View ${scope.leases} leases for scope ${scope.scopeId}`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-zinc-300 hover:border-pink-500/50 hover:text-pink-400 transition-colors ${FOCUS_RING}`}
            title="View leases"
          >
            <span className="text-zinc-500">leases</span>
            <span className="font-semibold text-gray-100">{scope.leases}</span>
          </button>
          <button
            onClick={() => onViewDetail("reservations")}
            aria-label={`View ${scope.reservations} reservations for scope ${scope.scopeId}`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-zinc-300 hover:border-pink-500/50 hover:text-pink-400 transition-colors ${FOCUS_RING}`}
            title="View reservations"
          >
            <span className="text-zinc-500">res</span>
            <span className="font-semibold text-gray-100">{scope.reservations}</span>
          </button>
        </div>

        {/* Affordance */}
        <button
          onClick={onExpand}
          aria-label={scope.expanded ? "Hide network details" : "Show network details"}
          aria-expanded={scope.expanded}
          className={`p-2 rounded text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 ${FOCUS_RING}`}
          title="Network details"
        >
          {scope.expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          scope.expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-zinc-700/40 bg-pink-100 px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
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
                    ["Source", source || "—"],
                    ["In Netbox", scope.hasNetbox ? "Yes" : "No"],
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
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const DHCPManager = () => {
  const navigate = useNavigate();
  const { siteCode } = useParams();
  const getToken = useSiteDashboardToken();

  const [scopesLoading, setScopesLoading] = useState(false);
  const [kiaScopes, setKiaScopes] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [scopesError, setScopesError] = useState(null);
  // Selection state is commented out along with the checkbox/manageable prop and
  // toggleSelect below — this push is view-only until scope management is built.
  // const [selectedScopes, setSelectedScopes] = useState([]);
  const [activeScope, setActiveScope] = useState(null);
  const [activeTab, setActiveTab] = useState("leases");

  // Inline site switcher — lets an engineer jump to another site's scopes
  // without leaving this page and re-navigating through /dhcp.
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [siteInput, setSiteInput] = useState(siteCode || "");

  useEffect(() => {
    setSiteInput(siteCode || "");
  }, [siteCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSitesLoading(true);
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const data = await listSites(token);
        if (!cancelled) setSites(data);
      } catch {
        // Non-critical: the switcher just has no options if this fails. The
        // page's actual scope data loads independently and isn't blocked by it.
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToSite = (code) => {
    const trimmed = (code || "").trim();
    if (trimmed && trimmed !== siteCode) navigate(`/${trimmed}/dhcp`);
  };

  const loadScopes = async (site) => {
    setScopesLoading(true);
    setHasLoaded(false);
    setScopesError(null);
    setKiaScopes([]);
    // setSelectedScopes([]);
    try {
      const token = await getToken();
      if (!token) return; // falling back to a redirect — page is about to navigate away
      const scopes = await getScopesForSite(site, token);
      setKiaScopes(scopes);
      setHasLoaded(true);
    } catch (err) {
      setScopesError(err.message || "Failed to load DHCP scopes — please try again.");
    } finally {
      setScopesLoading(false);
    }
  };

  useEffect(() => {
    if (siteCode) loadScopes(siteCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode]);

  const toggleKiaExpand = (id) =>
    setKiaScopes((prev) => prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)));

  // const toggleSelect = (id) =>
  //   setSelectedScopes((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));

  return (
    <div className="text-lg flex flex-col items-center">
      <div className="max-w-3xl mx-auto text-center mt-16 w-full px-4">
        <h1 className="text-3xl font-bold text-gray-100 leading-tight mb-3">DHCP Manager</h1>
        <div className="dark text-foreground max-w-xs mx-auto mb-2">
          <Autocomplete
            size="sm"
            label="Site Code"
            menuTrigger="input"
            placeholder="Search sites…"
            variant="bordered"
            isLoading={sitesLoading}
            isDisabled={scopesLoading}
            allowsCustomValue
            inputValue={siteInput}
            onInputChange={setSiteInput}
            onSelectionChange={(key) => {
              if (key) {
                setSiteInput(key);
                goToSite(key);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !sites.some((s) => s.name === siteInput)) goToSite(siteInput);
            }}
          >
            {sites.map((site) => (
              <AutocompleteItem key={site.name} value={site.name}>
                {site.name || "No Site Code"}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
        <p className="text-sm text-zinc-400">DHCP scopes for this site.</p>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-10">
        {scopesError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm text-center animate-fadeIn motion-reduce:animate-none">
            <p>{scopesError}</p>
            <button
              onClick={() => loadScopes(siteCode)}
              className={`mt-2 text-xs font-semibold underline hover:text-red-100 transition-colors rounded ${FOCUS_RING}`}
            >
              Try again
            </button>
          </div>
        )}

        {scopesLoading && (
          <div>
            <div className="flex items-center justify-center gap-3 pb-6 text-zinc-400">
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-pink-600" />
              </span>
              <span className="text-sm">
                Loading DHCP scopes for <span className="font-mono text-pink-400">{siteCode}</span>…
              </span>
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-800/50 rounded-lg animate-pulse border border-zinc-700/20"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {!scopesLoading && hasLoaded && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                DHCP Scopes
              </span>
              {/* View-only for this push — re-enable alongside scope management. */}
              {/* <span className="ml-auto text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/40">
                Manageable
              </span> */}
            </div>

            <div className="space-y-2 pb-10">
              {kiaScopes.length === 0 ? (
                <p className="text-sm text-zinc-500 italic py-4 text-center">
                  No DHCP scopes found for {siteCode}.
                </p>
              ) : (
                kiaScopes.map((scope) => (
                  <ScopeCard
                    key={scope.id}
                    scope={scope}
                    // manageable, selected, onSelect are commented out with the checkbox above —
                    // this push is view-only until scope management is built.
                    // manageable
                    // selected={selectedScopes.includes(scope.id)}
                    // onSelect={() => toggleSelect(scope.id)}
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

        {!scopesLoading && !hasLoaded && !scopesError && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <ServerIcon className="w-10 h-10 text-gray-600" />
            <p className="text-gray-400 text-sm max-w-sm">No DHCP scope data to show.</p>
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
