import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ServerIcon,
  GlobeAltIcon,
  TrashIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";
import DHCPScopeModal from "./DHCPScopeModal";
import { listSites, useSiteDashboardToken } from "../SiteDashboard/siteDashboardApi";
import { createSubnet, deleteSubnet, firstKeaPoolRange, generateDhcpScopeParams, getScopesForSite } from "./dhcpApi";
import Badge from "../DepotOrders/Badge";

// Scopes come from Netbox — a not-yet-deployed prefix can be pushed to Kea from here,
// but nothing is ever created in Netbox itself from this tool.

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500";

const STATUS_STYLES = {
  active: { dot: "bg-green-400", color: "green", label: "Active" },
  // Gizmo really does report "Inactive" — not just a fallback bucket.
  inactive: { dot: "bg-gray-500", color: "gray", label: "Inactive" },
  warning: { dot: "bg-yellow-400", color: "amber", label: "Warning" },
  error: { dot: "bg-red-400", color: "red", label: "Error" },
  unknown: { dot: "bg-gray-500", color: "gray", label: "Status unknown" },
  // Netbox prefix with no matching Gizmo/Kea record — a real, common case,
  // distinct from "unknown".
  not_deployed: { dot: "bg-gray-600", color: "gray", label: "Not deployed" },
};

function ipToInt(ip) {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return parts.reduce((acc, p) => acc * 256 + p, 0);
}

// Fallback only — the API returns a real `utilization` value (see
// getScopesForSite); this only kicks in if that's missing.
function utilizationPercent(scope) {
  const start = ipToInt(scope.start);
  const end = ipToInt(scope.end);
  if (start === null || end === null || end < start) return null;
  const poolSize = end - start + 1;
  if (poolSize <= 0) return null;
  return Math.min(100, Math.round((scope.leases / poolSize) * 100));
}

// Whether this scope has a matching Netbox prefix — independent of Active/
// Inactive. Gizmo/Kea scopes can exist without ever being in Netbox, which
// Active doesn't capture.
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

// Each row is one server's deployment — a subnet on both Gizmo and Kea gets
// two rows, not one with both flags. Null for not-deployed (status badge
// already covers that).
function sourceLabel(scope) {
  if (scope.hasGizmo) return "Gizmo";
  if (scope.hasKea) return "Kea";
  return null;
}

// Fill sweeps from 0 on mount; color interpolates green->red via the
// --dhcp-hue custom property (registered in index.css) instead of snapping.
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

// Active and unknown aren't worth a badge — only surface Inactive/warning/
// error/not_deployed.
const QUIET_STATUSES = new Set(["active", "unknown"]);

const ScopeCard = ({ scope, deleting, onExpand, onViewDetail, onDelete, onDeploy }) => {
  const statusStyle = STATUS_STYLES[scope.status] || STATUS_STYLES.unknown;
  const showStatus = !QUIET_STATUSES.has(scope.status);
  const utilization = scope.utilization ?? utilizationPercent(scope);
  const source = sourceLabel(scope);
  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden bg-gray-800/30">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Identity cluster: what this row IS */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
            <span className="hidden sm:inline-block">
              <Badge color={source === "Kea" ? "teal" : "purple"}>{source}</Badge>
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
          {/* A locally-mutated row (just deleted/deployed here, not yet confirmed by a
              real fetch) shows a badge instead of action buttons — acting again on top
              of an unconfirmed local guess is how this kind of state gets confusing. */}
          {scope._stale ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/20 border border-amber-700/40 text-amber-400"
              title="Change applied — refresh to update this row with the latest data"
            >
              {scope._pendingChange === "deleted" ? "Deleted" : "Deployed"} — refresh to update
            </span>
          ) : (
            <>
              {/* subnetv4 delete is Kea-specific — no Kea subnet on a Gizmo row. */}
              {scope.hasKea && (
                <button
                  onClick={() => onDelete(scope)}
                  disabled={deleting}
                  aria-label={`Delete scope ${scope.scopeId}/${scope.cidr}`}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-zinc-500 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40 ${FOCUS_RING}`}
                  title="Delete scope"
                >
                  <TrashIcon className={`w-3.5 h-3.5 ${deleting ? "animate-pulse" : ""}`} />
                </button>
              )}
              {/* Only a real Netbox prefix has params to generate — a scope with no Netbox
                  record at all has nothing for /dhcp/generate to work from. */}
              {scope.status === "not_deployed" && scope.netboxPrefixId && (
                <button
                  onClick={() => onDeploy(scope)}
                  aria-label={`Deploy scope ${scope.scopeId}/${scope.cidr} to Kea`}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-zinc-300 hover:border-green-500/50 hover:text-green-400 transition-colors ${FOCUS_RING}`}
                  title="Deploy to Kea"
                >
                  <CloudArrowUpIcon className="w-3.5 h-3.5" />
                  Deploy
                </button>
              )}
            </>
          )}
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
  const [activeScope, setActiveScope] = useState(null);
  const [activeTab, setActiveTab] = useState("leases");
  const [confirmDeleteScope, setConfirmDeleteScope] = useState(null);
  const [finalConfirmScope, setFinalConfirmScope] = useState(null);
  const [deletingScopeId, setDeletingScopeId] = useState(null);
  const [deleteScopeError, setDeleteScopeError] = useState(null);

  const [deployScope, setDeployScope] = useState(null);
  const [deployParams, setDeployParams] = useState(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const [deployStart, setDeployStart] = useState("");
  const [deployEnd, setDeployEnd] = useState("");
  const [deploying, setDeploying] = useState(false);

  // Inline site switcher — jump sites without leaving the page.
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
        // Non-critical — switcher just has no options; scope data loads independently.
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

  const pendingChangeCount = kiaScopes.filter((s) => s._stale).length;

  // Skips the full re-fetch after a delete — on a large site, re-gathering every
  // scope just to confirm the one you already know succeeded is slow for no reason.
  // Instead this downgrades the row locally to what a real refresh would eventually
  // show (no more Kea presence) and flags it stale until that refresh actually happens.
  const handleDeleteScope = async (scope) => {
    setConfirmDeleteScope(null);
    setFinalConfirmScope(null);
    setDeletingScopeId(scope.id);
    setDeleteScopeError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await deleteSubnet(scope.scopeId, scope.cidr, token);
      setKiaScopes((prev) =>
        prev.map((s) =>
          s.id === scope.id
            ? {
                ...s,
                hasKea: false,
                leases: 0,
                reservations: 0,
                utilization: null,
                status: "not_deployed",
                _stale: true,
                _pendingChange: "deleted",
              }
            : s
        )
      );
    } catch (err) {
      setDeleteScopeError(err.message || "Failed to delete scope — please try again.");
    } finally {
      setDeletingScopeId(null);
    }
  };

  // scope.leases includes reservation-backed leases too, so anything beyond
  // scope.reservations is a real dynamic lease that'll be orphaned — worth a
  // second, harder confirmation before deleting.
  const unreservedLeaseCount = (scope) => Math.max(0, scope.leases - scope.reservations);

  const openDeployModal = async (scope) => {
    setDeployScope(scope);
    setDeployParams(null);
    setDeployError(null);
    setDeployStart("");
    setDeployEnd("");
    setDeployLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params = await generateDhcpScopeParams(scope.netboxPrefixId, token);
      setDeployParams(params);
      const range = firstKeaPoolRange(params?.pools);
      setDeployStart(range.start || "");
      setDeployEnd(range.end || "");
    } catch (err) {
      setDeployError(err.message || "Failed to generate scope parameters — please try again.");
    } finally {
      setDeployLoading(false);
    }
  };

  const closeDeployModal = () => {
    setDeployScope(null);
    setDeployParams(null);
    setDeployError(null);
  };

  // Generated params are otherwise passed straight through — the range is the only
  // thing the user is asked to edit before this deploys, per the initial cut of this flow.
  // shared-network-name isn't part of the generate response, but Kea's create API requires it.
  const buildDeployPayload = (params, start, end) => ({
    ...params,
    "shared-network-name": params["shared-network-name"] ?? null,
    pools: [{ ...(params.pools?.[0] || {}), pool: `${start.trim()}-${end.trim()}` }],
  });

  // Same reasoning as handleDeleteScope: no full re-fetch, just a provisional row built
  // from what we submitted (not Kea's authoritative response) so it's flagged stale
  // rather than presented as confirmed.
  const handleDeploy = async () => {
    if (!deployParams || !deployScope) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const payload = buildDeployPayload(deployParams, deployStart, deployEnd);
      await createSubnet(payload, token);

      const cidrKey = `${deployScope.scopeId}/${deployScope.cidr}`;
      const provisionalRow = {
        ...deployScope,
        id: `${cidrKey}::kea`,
        start: deployStart.trim(),
        end: deployEnd.trim(),
        leases: 0,
        reservations: 0,
        utilization: 0,
        status: "unknown",
        hasGizmo: false,
        hasKea: true,
        _stale: true,
        _pendingChange: "deployed",
      };
      setKiaScopes((prev) => prev.map((s) => (s.id === deployScope.id ? provisionalRow : s)));

      closeDeployModal();
    } catch (err) {
      setDeployError(err.message || "Failed to deploy scope — please try again.");
    } finally {
      setDeploying(false);
    }
  };

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
              // Only fall back to free-text navigation when nothing in the list matches —
              // otherwise let Autocomplete's own Enter-selects-highlighted-item win.
              const hasMatch = sites.some((s) => s.name.toLowerCase().includes(siteInput.trim().toLowerCase()));
              if (e.key === "Enter" && !hasMatch) goToSite(siteInput);
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

        {deleteScopeError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm text-center animate-fadeIn motion-reduce:animate-none">
            {deleteScopeError}
          </div>
        )}

        {!scopesLoading && hasLoaded && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                DHCP Scopes
              </span>
              {pendingChangeCount > 0 && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-amber-400">
                    {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} made — refresh to update
                  </span>
                  <button
                    onClick={() => loadScopes(siteCode)}
                    className={`font-semibold text-amber-300 underline hover:text-amber-100 transition-colors rounded ${FOCUS_RING}`}
                  >
                    Refresh
                  </button>
                </div>
              )}
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
                    deleting={deletingScopeId === scope.id}
                    onExpand={() => toggleKiaExpand(scope.id)}
                    onViewDetail={(tab) => {
                      setActiveTab(tab);
                      setActiveScope(scope);
                    }}
                    onDelete={setConfirmDeleteScope}
                    onDeploy={openDeployModal}
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

      {confirmDeleteScope && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-scope-title"
            className="w-full max-w-sm rounded-xl border border-zinc-700/60 bg-gray-900 p-6 shadow-xl"
          >
            <h3 id="confirm-delete-scope-title" className="text-lg font-bold text-gray-100 mb-3">
              Delete scope?
            </h3>
            <dl className="text-xs mb-4 space-y-1.5 rounded-lg border border-zinc-700/50 bg-gray-800/40 p-3">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Scope</dt>
                <dd className="font-mono text-gray-100">
                  {confirmDeleteScope.scopeId}/{confirmDeleteScope.cidr}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Name</dt>
                <dd className="text-gray-100 text-right">{confirmDeleteScope.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Active leases</dt>
                <dd className={`font-semibold ${confirmDeleteScope.leases > 0 ? "text-yellow-400" : "text-gray-100"}`}>
                  {confirmDeleteScope.leases}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Reservations</dt>
                <dd
                  className={`font-semibold ${
                    confirmDeleteScope.reservations > 0 ? "text-yellow-400" : "text-gray-100"
                  }`}
                >
                  {confirmDeleteScope.reservations}
                </dd>
              </div>
            </dl>
            {(confirmDeleteScope.leases > 0 || confirmDeleteScope.reservations > 0) && (
              <p className="text-xs text-yellow-400 mb-4">
                This scope has active leases or reservations — deleting it will orphan them.
              </p>
            )}
            <p className="text-xs text-zinc-500 mb-6">This can't be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteScope(null)}
                className={`text-xs px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white transition-colors ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (unreservedLeaseCount(confirmDeleteScope) > 0) {
                    setFinalConfirmScope(confirmDeleteScope);
                    setConfirmDeleteScope(null);
                  } else {
                    handleDeleteScope(confirmDeleteScope);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors ${FOCUS_RING}`}
              >
                {unreservedLeaseCount(confirmDeleteScope) > 0 ? "Continue" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {finalConfirmScope && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="final-confirm-delete-scope-title"
            className="w-full max-w-sm rounded-xl border border-red-700/60 bg-gray-900 p-6 shadow-xl"
          >
            <h3 id="final-confirm-delete-scope-title" className="text-lg font-bold text-red-400 mb-3">
              Are you sure?
            </h3>
            <p className="text-xs text-gray-200 mb-6">
              This scope has <span className="font-semibold text-yellow-400">
                {unreservedLeaseCount(finalConfirmScope)}
              </span>{" "}
              active lease(s) that aren't reservations — deleting it will disconnect those devices.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFinalConfirmScope(null)}
                className={`text-xs px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white transition-colors ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteScope(finalConfirmScope)}
                className={`text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors ${FOCUS_RING}`}
              >
                Yes, delete anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {deployScope && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deploy-scope-title"
            className="w-full max-w-lg rounded-xl border border-zinc-700/60 bg-gray-900 p-6 shadow-xl"
          >
            <h3 id="deploy-scope-title" className="text-lg font-bold text-gray-100 mb-1">
              Deploy to Kea
            </h3>
            <p className="text-xs font-mono text-zinc-500 mb-4">
              {deployScope.scopeId}/{deployScope.cidr} &mdash; {deployScope.name}
            </p>

            {deployLoading && (
              <p className="text-sm text-zinc-500 italic text-center py-8">Generating scope parameters…</p>
            )}

            {deployError && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-xs text-center">
                {deployError}
              </div>
            )}

            {!deployLoading && deployParams && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label htmlFor="deploy-start" className="block text-xs text-zinc-400 mb-1">
                      Start Address
                    </label>
                    <input
                      id="deploy-start"
                      type="text"
                      value={deployStart}
                      onChange={(e) => setDeployStart(e.target.value)}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 focus:outline-none focus:border-pink-500/50 ${FOCUS_RING}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="deploy-end" className="block text-xs text-zinc-400 mb-1">
                      End Address
                    </label>
                    <input
                      id="deploy-end"
                      type="text"
                      value={deployEnd}
                      onChange={(e) => setDeployEnd(e.target.value)}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg bg-gray-800/60 border border-zinc-700/50 text-gray-100 focus:outline-none focus:border-pink-500/50 ${FOCUS_RING}`}
                    />
                  </div>
                </div>

                <p className="text-xs text-zinc-500 mb-1">This is exactly what will be sent:</p>
                <pre className="mb-4 max-h-48 overflow-auto text-[11px] leading-relaxed text-zinc-300 bg-gray-800/40 border border-zinc-700/50 rounded-lg p-3">
                  {JSON.stringify([buildDeployPayload(deployParams, deployStart, deployEnd)], null, 2)}
                </pre>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeployModal}
                className={`text-xs px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white transition-colors ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={!deployParams || !deployStart.trim() || !deployEnd.trim() || deploying}
                className={`text-xs px-3 py-1.5 rounded-lg bg-green-600 text-black font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
              >
                {deploying ? "Deploying…" : "Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DHCPManager;
