import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { BuildingOfficeIcon, UsersIcon, DocumentTextIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getActiveWeatherAlerts,
  getCurrentWeather,
  getScopesForSite,
  getDiagramDevices,
  getLatestRadarFrame,
  getMistDevices,
  getNetboxSiteIdByCode,
  getOpengearDevices,
  getOpengearSummary,
  getRecentDailyWeather,
  getCircuitsForSite,
  getRecentIncidents,
  getServiceNowLocationBySite,
  getServiceNowUsers,
  referenceDisplay,
  getSiteDashboardData,
  getSnowLocation,
  listSites,
  useSiteDashboardToken,
} from "./siteDashboardApi";
import { getSnipeitAssetBySerial } from "../DepotOrders/snipeitApi";

const NETBOX_UI_BASE_URL = "https://netbox.kiewit.com";
const SNIPEIT_UI_BASE_URL = "https://netinv.kiewitplaza.com";

// This endpoint has no site filter (see getRecentIncidents) — every option here pulls every
// incident assigned to the network group org-wide, filtered down client-side afterward, so
// the window is capped rather than left open-ended: going back further means fetching (and
// discarding) proportionally more org-wide records just to find this one site's handful.
const INCIDENTS_DEFAULT_DAYS = 30;
const INCIDENTS_MAX_DAYS = 90;
const INCIDENTS_DAY_OPTIONS = [7, 14, 30, 60, INCIDENTS_MAX_DAYS];

const MIST_LINKABLE_TYPES = new Set(["switch", "gateway", "router", "ap"]);

function mistDetailUrl(mistId, type, mistSiteId) {
  const orgId = process.env.REACT_APP_MIST_ORG_ID;
  const mistType = type === "gateway" || type === "router" ? "gateway" : type === "ap" ? "ap" : "switch";
  return `https://manage.mist.com/admin/?org_id=${orgId}#!${mistType}/detail/${mistId}/${mistSiteId ?? ""}`;
}

// Prefers a real name resolved via getServiceNowUsers (sys_id -> display name, fetched for
// every assigned_to/opened_by/caller_id sys_id across the current incident list) over
// referenceDisplay's raw-sys_id fallback — see the userDisplayMap effect below.
function resolveReference(field, userMap) {
  if (!field) return null;
  if (typeof field === "string") return field || null;
  return userMap.get(field.value) || referenceDisplay(field);
}

// "state"/"incident_state" arrive as human text like "Closed"/"In Progress" if
// sysparm_display_value is honored (see getRecentIncidents), or as ServiceNow's raw numeric
// codes if it isn't. Confirmed org-specific mapping (not the ServiceNow OOB defaults) — 3/4/5
// are unused at this org, and the negative codes are the various "awaiting X" states.
const CLOSED_STATE_CODES = new Set(["6", "7", "8"]);
const INCIDENT_STATE_LABELS = {
  1: "Open",
  2: "Work In Progress",
  6: "Resolved",
  7: "Closed Complete",
  8: "Closed Canceled",
  "-4": "Awaiting Customer",
  "-19": "Awaiting Internal",
  "-12": "Awaiting Vendor",
  "-11": "Customer Responded",
  "-2": "Scheduled",
};
function isClosedState(state) {
  return CLOSED_STATE_CODES.has((state ?? "").toString().trim());
}

// Confirmed org-specific incident priority scale (from getPriorityString()) — this org only
// uses 1-4, unlike ServiceNow's OOB 1-5 scale. Severity is still unconfirmed for this org.
const PRIORITY_LABELS = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };
const SEVERITY_LABELS = { 1: "High", 2: "Medium", 3: "Low" };
function codeLabel(value, labels) {
  if (!value) return null;
  const s = value.toString().trim();
  return labels[s] ? `${s} - ${labels[s]}` : value;
}
function stateLabel(state) {
  const s = (state ?? "").toString().trim();
  return INCIDENT_STATE_LABELS[s] || state;
}
// 1 (Critical) and 2 (High) on the standard ServiceNow priority scale.
function isHighPriority(priority) {
  const s = (priority ?? "").toString().trim();
  return s === "1" || s === "2";
}

// ServiceNow's display timestamps come back as "YYYY-MM-DD HH:MM:SS" — readable, but not
// localized. Reformatted into the viewer's own locale/date-time style; falls back to the raw
// string if it doesn't parse as a date (e.g. any unexpected format).
function formatSnowDate(value) {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function IncidentStatusBadge({ state }) {
  if (!state) return <span className="text-gray-600 text-[11px]">—</span>;
  const closed = isClosedState(state);
  return (
    <span
      className={`text-[11px] px-1.5 py-0.5 rounded-full border shrink-0 ${
        closed ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-amber-900/30 border-amber-700/40 text-amber-300"
      }`}
    >
      {stateLabel(state)}
    </span>
  );
}

function IncidentsCard({ incidents, loading, error, onSelect, userMap, daysAgo, onChangeDaysAgo, onRetry }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col min-h-[140px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-400">Recent Tickets / Outages</h3>
        <select
          value={daysAgo}
          onChange={(e) => onChangeDaysAgo(Number(e.target.value))}
          aria-label="Filter incidents by days back"
          className="text-[11px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400 focus:outline-none focus:border-gray-500"
        >
          {INCIDENTS_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d}d
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="space-y-2">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-5/6" />
        </div>
      ) : error ? (
        <RetryError message={error} onRetry={onRetry} />
      ) : incidents.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No recent incidents for this site.</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto max-h-48 pr-1">
          {incidents.map((inc, i) => {
            const state = inc.state || inc.incident_state;
            const assignedTo = resolveReference(inc.assigned_to, userMap);
            return (
              <li key={inc.sys_id ?? inc.number ?? i}>
                <button
                  onClick={() => onSelect(inc)}
                  className="w-full text-left text-xs border-b border-gray-800/60 pb-1.5 hover:bg-gray-800/40 rounded px-1 -mx-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-gray-400">
                      {isHighPriority(inc.priority) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="High priority" />
                      )}
                      {inc.number ?? "—"}
                    </span>
                    <IncidentStatusBadge state={state} />
                  </div>
                  <p className="text-gray-300 truncate">{inc.short_description || "—"}</p>
                  <div className="flex items-center justify-between gap-2 mt-0.5 text-gray-600">
                    <span className="truncate">{assignedTo ? `Assigned: ${assignedTo}` : "Unassigned"}</span>
                    {inc.sys_created_on && <span className="shrink-0">{formatSnowDate(inc.sys_created_on)}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function circuitName(c) {
  return resolveScalar(c.name) || "—";
}
// u_primary_service (e.g. "Point to Point", "Internet", "SIP", "POTS", "Ethernet") is the
// meaningful type breakdown. The top-level `type` field is always "AC" on every circuit —
// unrelated CMDB metadata, not circuit type — so it's not used despite being non-empty.
// u_type (Data/Voice) is a coarser fallback for records missing u_primary_service.
function circuitType(c) {
  return resolveScalar(c.u_primary_service) || resolveScalar(c.u_type) || null;
}
// The coarse Data/Voice split — used for the type filter (per request, instead of the more
// granular u_primary_service breakdown above, which is still shown per-row).
function circuitCategory(c) {
  return resolveScalar(c.u_type) || null;
}
const CIRCUIT_ACTIVE_WORDS = ["active", "connected", "installed", "operational"];
const CIRCUIT_INACTIVE_WORDS = ["disconnected", "inactive", "cancelled", "canceled", "removed"];
// u_status ("Active"/"Disconnected") is the real signal — operational_status/install_status
// are both a constant "1" across every circuit regardless of actual state (confirmed in the
// same payload), so they'd always say "active" even for a disconnected circuit and aren't
// used. null = couldn't tell, treated as "still show it" by the Active filter below rather
// than hiding a circuit whose u_status uses a word this doesn't recognize.
function circuitIsActive(c) {
  const status = resolveScalar(c.u_status).toLowerCase().trim();
  if (!status) return null;
  if (CIRCUIT_INACTIVE_WORDS.some((w) => status.includes(w))) return false;
  if (CIRCUIT_ACTIVE_WORDS.some((w) => status.includes(w))) return true;
  return null;
}
function circuitSpeed(c) {
  return resolveScalar(c.u_max_speed) || null;
}

const CIRCUIT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

function CircuitsCard({ circuits, loading, error, onSelect, onRetry }) {
  const [typeFilter, setTypeFilter] = useState("Data");
  const [statusFilter, setStatusFilter] = useState("active");
  const activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const categories = useMemo(
    () => [...new Set(circuits.map(circuitCategory).filter(Boolean))].sort(),
    [circuits],
  );

  const filtered = useMemo(() => {
    return circuits.filter((c) => {
      const matchesType =
        typeFilter === "all" || (circuitCategory(c) || "").toLowerCase() === typeFilter.toLowerCase();
      const active = circuitIsActive(c);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active !== false) ||
        (statusFilter === "inactive" && active === false);
      return matchesType && matchesStatus;
    });
  }, [circuits, typeFilter, statusFilter]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col min-h-[140px]">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-400">Circuits</h3>
        <div className="flex items-center gap-1.5">
          {activeFilterCount > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
            </span>
          )}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter circuits by type"
            className="text-[11px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400 focus:outline-none focus:border-gray-500"
          >
            <option value="all">All Types</option>
            {categories.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter circuits by status"
            className="text-[11px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400 focus:outline-none focus:border-gray-500"
          >
            {CIRCUIT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-5/6" />
        </div>
      ) : error ? (
        <RetryError message={error} onRetry={onRetry} />
      ) : circuits.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No circuits found for this site.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No circuits match this filter.</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto max-h-48 pr-1">
          {filtered.map((c, i) => {
            const active = circuitIsActive(c);
            const type = circuitType(c);
            const speed = circuitSpeed(c);
            return (
              <li key={c.sys_id ?? i}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full text-left text-xs border-b border-gray-800/60 last:border-0 pb-1.5 pt-1 -mx-1 px-1 rounded hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 truncate">{circuitName(c)}</span>
                    {active !== null && (
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-full border shrink-0 ${
                          active
                            ? "bg-green-900/30 border-green-700/40 text-green-300"
                            : "bg-gray-800 border-gray-700 text-gray-400"
                        }`}
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    {type && <span>{type}</span>}
                    {speed && <span className="font-mono">{speed}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatCurrency(value) {
  const n = Number(value);
  return Number.isNaN(n) ? value : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mirrors the real ServiceNow circuit form's field layout, two-column left/right grouping.
// Key names beyond the four already confirmed (u_primary_service, u_type, u_status,
// u_max_speed) are best guesses following this integration's u_-prefix convention; if one's
// wrong, that field just renders blank rather than breaking anything.
const CIRCUIT_LEFT_FIELDS = [
  { key: "u_type", label: "Type" },
  { key: "u_max_speed", label: "Max Speed" },
  { key: "u_carrier", label: "Carrier" },
  { key: "u_account_number", label: "Account Number" },
  { key: "u_primary_service", label: "Primary Service" },
  { key: "u_installation_days", label: "Installation Days" },
  { key: "u_contract_start", label: "Contract Start Date", format: formatFullDate },
  { key: "u_contract_end", label: "Contract End Date", format: formatFullDate },
];
const CIRCUIT_RIGHT_FIELDS = [
  { key: "u_cost_code", label: "Cost Code" },
  { key: "u_months_contract", label: "Months of Contract" },
  { key: "mrc", label: "MRC (Monthly)", format: formatCurrency },
  { key: "nrc", label: "NRC (Install)", format: formatCurrency },
];

function buildCircuitFields(circuit, fieldDefs) {
  return fieldDefs
    .map(({ key, label, format }) => {
      const resolved = resolveScalar(circuit[key]);
      if (resolved === "" || resolved == null) return null;
      return { key, label, value: format ? format(resolved) : resolved };
    })
    .filter(Boolean);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Extra padding (offset by a matching negative margin so it doesn't shift surrounding layout)
// brings the click/tap target close to the 44x44px guideline without changing the visible ×.
const MODAL_CLOSE_BUTTON_CLASS =
  "text-gray-500 hover:text-gray-300 text-2xl leading-none p-2 -m-2 rounded hover:bg-gray-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500";

// Focus trap + Escape-to-close + focus restore — same pattern already used by
// ManageDHCP/DHCPScopeModal.js, shared here since every modal on this page needs identical
// behavior. Every modal that uses this is only ever mounted while open (the parent renders it
// via `{selectedX && <Modal .../>}`), so mount = open and unmount = close; the effect just runs
// once per mount rather than needing an explicit "active" flag.
function useModalA11y(dialogRef, onClose) {
  const previouslyFocusedRef = useRef(null);
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelectorAll(FOCUSABLE_SELECTOR)?.[0]?.focus();

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
  }, []);
}

// locationRecord is the already-fetched /servicenow/locations record for the current site
// (see the siteCode-keyed effect above) — used here instead of the circuit's own `location`
// reference field, which only carries an unresolved sys_id.
function CircuitDetailModal({ circuit, locationRecord, onClose }) {
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, onClose);
  if (!circuit) return null;
  const active = circuitIsActive(circuit);
  const comments = resolveScalar(circuit.comments) || resolveScalar(circuit.description);
  const locationDisplay = locationRecord?.u_display_name || locationRecord?.name || null;

  const leftFields = buildCircuitFields(circuit, CIRCUIT_LEFT_FIELDS);
  const rightFields = [
    { key: "u_status", label: "Status", value: active === null ? resolveScalar(circuit.u_status) : (
      <span className={active ? "text-green-400" : "text-gray-400"}>{active ? "Active" : "Inactive"}</span>
    ) },
    ...buildCircuitFields(circuit, CIRCUIT_RIGHT_FIELDS),
    ...(locationDisplay ? [{ key: "location", label: "Location", value: locationDisplay }] : []),
  ];

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="circuit-modal-title"
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-4xl min-h-[60vh] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3 gap-3 shrink-0">
          <h3 id="circuit-modal-title" className="text-base font-mono font-semibold text-gray-100">
            {circuitName(circuit)}
          </h3>
          <button onClick={onClose} aria-label="Close" className={MODAL_CLOSE_BUTTON_CLASS}>
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 border-t border-gray-800 pt-3 shrink-0">
          <div className="space-y-1.5">
            {leftFields.map((f) => (
              <IncidentDetailField key={f.key} label={f.label} value={f.value} />
            ))}
          </div>
          <div className="space-y-1.5">
            {rightFields.map((f) => (
              <IncidentDetailField key={f.key} label={f.label} value={f.value} />
            ))}
          </div>
        </div>

        {comments && (
          <div className="border-t border-gray-800 mt-3 pt-3 flex-1 min-h-0 flex flex-col">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5 shrink-0">Comments</h4>
            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto pr-1 pb-2">
              {comments}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function IncidentDetailField({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4 text-xs py-1">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-gray-200 text-right">{value}</span>
    </div>
  );
}

// The list endpoint's own results already contain the full record (description, close
// notes, every timestamp) — same object shown in the card row, no separate detail fetch.
function IncidentDetailModal({ incident, onClose, userMap }) {
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, onClose);
  if (!incident) return null;
  const state = incident.state || incident.incident_state;
  // Portaled straight to document.body — this page nests the modal many levels deep, and a
  // "fixed" backdrop only actually covers the full viewport if none of those ancestors set a
  // transform/filter/perspective (any of which quietly turns "fixed" into "positioned
  // relative to that ancestor" instead of the viewport, leaving a gap wherever that ancestor
  // starts). A portal sidesteps the question entirely.
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-modal-title"
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <h3 className="text-sm font-mono text-gray-400">{incident.number}</h3>
            <p id="incident-modal-title" className="text-base font-semibold text-gray-100 mt-0.5">
              {incident.short_description}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IncidentStatusBadge state={state} />
            <button onClick={onClose} aria-label="Close" className={MODAL_CLOSE_BUTTON_CLASS}>
              &times;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 border-t border-gray-800 pt-3">
          <div>
            <IncidentDetailField label="Assigned To" value={resolveReference(incident.assigned_to, userMap)} />
            <IncidentDetailField label="Opened By" value={resolveReference(incident.opened_by, userMap)} />
            <IncidentDetailField label="Caller" value={resolveReference(incident.caller_id, userMap)} />
            <IncidentDetailField label="Category" value={incident.category} />
            <IncidentDetailField label="Subcategory" value={incident.subcategory} />
          </div>
          <div>
            <IncidentDetailField label="Opened" value={formatSnowDate(incident.opened_at)} />
            <IncidentDetailField label="Resolved" value={formatSnowDate(incident.resolved_at)} />
            <IncidentDetailField label="Closed" value={formatSnowDate(incident.closed_at)} />
            <IncidentDetailField label="Priority" value={codeLabel(incident.priority, PRIORITY_LABELS)} />
            <IncidentDetailField label="Severity" value={codeLabel(incident.severity, SEVERITY_LABELS)} />
          </div>
        </div>

        {incident.description && (
          <div className="border-t border-gray-800 mt-3 pt-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Description</h4>
            <p className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{incident.description}</p>
          </div>
        )}

        {incident.close_notes && (
          <div className="border-t border-gray-800 mt-3 pt-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
              Close Notes {incident.close_code ? `(${incident.close_code})` : ""}
            </h4>
            <p className="text-xs text-gray-300 whitespace-pre-wrap">{incident.close_notes}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Portaled for the same reason as IncidentDetailModal above.
function NotesModal({ description, comments, onClose }) {
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-modal-title"
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="notes-modal-title" className="text-sm font-semibold text-gray-300">
            Site Notes
          </h3>
          <button onClick={onClose} aria-label="Close" className={MODAL_CLOSE_BUTTON_CLASS}>
            &times;
          </button>
        </div>
        <div className="space-y-3">
          {description && <p className="text-sm text-gray-200 whitespace-pre-wrap">{description}</p>}
          {comments && <p className="text-xs text-gray-400 whitespace-pre-wrap italic">{comments}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SkeletonBar({ className }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />;
}

// Every section fetches independently with its own cancel-safe effect, so retrying is cheap —
// previously a failed section had no recovery path besides a full page reload, which also
// wiped unrelated state (device-table search/sort/columns) that had nothing to do with the
// failure. onRetry is optional so callers with no retry path (e.g. weather) can omit it.
function RetryError({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-red-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-[11px] px-2 py-0.5 rounded border border-red-500/50 text-red-300 hover:bg-red-900/30 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <SkeletonBar className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBar key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 4 }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <SkeletonBar className="h-4 w-1/4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBar key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// Source styling mirrors ManageDHCP/DHCPManager.js so a scope reads the same way in both
// places. Each row is exactly one server's deployment of a subnet (see getScopesForSite) —
// a subnet on both Gizmo and Kea produces two rows here, not one merged row.
function dhcpSourceLabel(scope) {
  if (scope.hasGizmo) return "Gizmo";
  if (scope.hasKea) return "Kea";
  return null;
}

function DhcpScopeRow({ scope }) {
  const source = dhcpSourceLabel(scope);
  const hasRange = scope.start !== "—" || scope.end !== "—";
  return (
    <tr className="text-gray-300 align-top">
      <td className="px-2 py-2">
        <div className="font-mono text-gray-200">
          {scope.scopeId}
          {scope.cidr != null ? `/${scope.cidr}` : ""}
        </div>
        <div className="text-xs text-gray-500">{scope.name}</div>
      </td>
      <td className="px-2 py-2">
        {source ? (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full border ${
              source === "Gizmo"
                ? "bg-amber-900/40 border-amber-700/50 text-amber-300"
                : "bg-teal-900/30 border-teal-700/40 text-teal-300"
            }`}
          >
            {source}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
      <td className="px-2 py-2 font-mono text-xs text-gray-400 whitespace-nowrap">
        {hasRange ? `${scope.start} – ${scope.end}` : "—"}
      </td>
      <td className="px-2 py-2 font-mono text-xs text-gray-400">{scope.gateway}</td>
      <td className="px-2 py-2 text-xs text-gray-400 whitespace-nowrap">
        {scope.leases} leased / {scope.reservations} reserved
      </td>
      <td className="px-2 py-2">
        {scope.utilization != null ? (
          <div className="flex items-center gap-1.5 w-20">
            <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-400"
                style={{ width: `${scope.utilization}%` }}
              />
            </div>
            <span className="font-mono text-xs text-gray-400">{scope.utilization}%</span>
          </div>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

const DHCP_SCOPES_PAGE_SIZE = 5;

function DhcpScopesCard({ siteCode, scopes, error, onRetry }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopes;
    return scopes.filter((s) => `${s.scopeId} ${s.cidr} ${s.name}`.toLowerCase().includes(q));
  }, [scopes, search]);

  useEffect(() => {
    setPage(0);
  }, [search, scopes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / DHCP_SCOPES_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageScopes = filtered.slice(
    clampedPage * DHCP_SCOPES_PAGE_SIZE,
    clampedPage * DHCP_SCOPES_PAGE_SIZE + DHCP_SCOPES_PAGE_SIZE,
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-400">DHCP Scopes</h3>
        <Link to={`/${siteCode}/dhcp`} className="text-xs text-pink-500 hover:text-pink-400">
          Manage DHCP →
        </Link>
      </div>
      {error ? (
        <RetryError message={error} onRetry={onRetry} />
      ) : scopes.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No DHCP scopes found for this site.</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search scopes…"
            aria-label="Search DHCP scopes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No scopes match "{search}".</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">Scope</th>
                      <th className="text-left px-2 py-1.5">Source</th>
                      <th className="text-left px-2 py-1.5">Range</th>
                      <th className="text-left px-2 py-1.5">Gateway</th>
                      <th className="text-left px-2 py-1.5">Leases / Reservations</th>
                      <th className="text-left px-2 py-1.5">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {pageScopes.map((s) => (
                      <DhcpScopeRow key={s.id} scope={s} />
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={clampedPage === 0}
                    className="px-2 py-1 rounded border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Prev
                  </button>
                  <span>
                    Page {clampedPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={clampedPage === totalPages - 1}
                    className="px-2 py-1 rounded border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// icmp = 4G connection, snmp = Wired connection, same labeling as OpengearReports.js.
// loading is distinct from !conn: loading means the status call just hasn't resolved yet,
// while !conn (once loaded) means the connection is genuinely not configured — conflating
// the two would flash a false "Not Configured" while the slower of the two Opengear calls
// is still in flight.
function OpengearConnectionRow({ label, conn, loading }) {
  const isActive = conn?.status === 1;
  return (
    <div className="flex items-center justify-between gap-2 text-xs py-1.5">
      <span className="text-gray-400 shrink-0 w-12">{label}</span>
      {loading ? (
        <span className="ml-auto w-20 h-3 rounded bg-gray-800 animate-pulse" />
      ) : !conn ? (
        <span className="text-yellow-400 ml-auto">Not Configured</span>
      ) : (
        <>
          {conn.ip ? (
            isActive ? (
              <a
                href={`https://${conn.ip}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline truncate"
              >
                {conn.ip}
              </a>
            ) : (
              <span className="text-gray-500 truncate">{conn.ip}</span>
            )
          ) : (
            <span className="text-red-400">No IP</span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-gray-300">{isActive ? "Active" : "Inactive"}</span>
          </span>
        </>
      )}
    </div>
  );
}

// Inventory fields from the summary endpoint. Wired/Cell IP are shown even though
// OpengearConnectionRow already shows the LibreNMS-monitored IP+status for each
// connection — the two can disagree (e.g. LibreNMS says "Not Configured" while the
// summary endpoint has a real wiredip), and that mismatch is itself the useful signal:
// it tells someone whether they're looking at a real config/wiring issue or just a
// monitoring gap.
function OpengearInventoryFields({ device, loading }) {
  const fields = [
    ["Wired IP", device.wiredip],
    ["Cell IP", device.cellip],
    ["Model", device.model],
    ["Serial", device.serial],
    ["Firmware", device.version],
    ["MAC", device.mac],
    ["IMEI", device.imei],
    ["ICCID", device.iccid],
  ].filter(([, value]) => value);
  // The summary call hasn't resolved yet for this device (it showed up via the status call
  // instead) — show a placeholder rather than silently rendering nothing.
  if (fields.length === 0 && loading) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-gray-800/60">
        <span className="block w-32 h-3 rounded bg-gray-800 animate-pulse" />
      </div>
    );
  }
  if (fields.length === 0) return null;
  return (
    <div className="mt-1.5 pt-1.5 border-t border-gray-800/60 space-y-1">
      {fields.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-gray-500">{label}</span>
          <span className="text-gray-300 font-mono truncate">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Matches OpengearCard's own width/shape (SkeletonTable is full-width and doesn't fit the
// narrow max-w-sm slot this card sits in next to DHCP Scopes) so the loading state doesn't
// jump in size once real data replaces it.
function OpengearCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm flex-shrink-0">
      <SkeletonBar className="h-4 w-24 mb-3" />
      <SkeletonBar className="h-4 w-32 mb-2" />
      <SkeletonBar className="h-3 w-20 mb-2" />
      <div className="space-y-1.5">
        <SkeletonBar className="h-3 w-full" />
        <SkeletonBar className="h-3 w-full" />
      </div>
    </div>
  );
}

function OpengearCard({ devices, error, statusLoading, summaryLoading, onRetry }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm flex-shrink-0">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Opengear</h3>
      {error ? (
        <RetryError message={error} onRetry={onRetry} />
      ) : devices.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No Opengear devices found for this site.</p>
      ) : (
        <div className="space-y-3">
          {devices.map((og, idx) => (
            <div key={og.name ?? idx}>
              {og.netboxid ? (
                <a
                  href={`${NETBOX_UI_BASE_URL}/dcim/devices/${og.netboxid}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-gray-200 hover:text-blue-400 transition-colors"
                >
                  {og.name || "Unknown"}
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-200">{og.name || "Unknown"}</p>
              )}
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">LibreNMS Status</p>
              <div className="divide-y divide-gray-800">
                <OpengearConnectionRow label="4G" conn={og.icmp} loading={statusLoading} />
                <OpengearConnectionRow label="Wired" conn={og.snmp} loading={statusLoading} />
              </div>
              <OpengearInventoryFields device={og} loading={summaryLoading} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Name is the only field consistently present across all sources, so it's the merge key —
// first non-empty value wins per field.
function mergeDevicesByName(netboxDevices, diagramDevices, mistDevices, mistSiteId, opengearDevices = []) {
  const map = new Map();
  const upsert = (rawName, fields) => {
    const name = (rawName || "").trim();
    const key = name.toLowerCase();
    if (!key) return;
    const existing =
      map.get(key) ||
      {
        name,
        vendor: null,
        model: null,
        ip: null,
        status: null,
        type: null,
        serial: null,
        mac: null,
        polling: null,
        alert: null,
        inMist: null,
        version: null,
        uptime: null,
        netboxId: null,
        mistId: null,
      };
    Object.keys(fields).forEach((k) => {
      if (!existing[k] && fields[k]) existing[k] = fields[k];
    });
    map.set(key, existing);
  };
  // Mist devices are always Juniper hardware by definition — a structural default, not a
  // guess, for the vendor field Mist's summary doesn't itself report.
  //
  // inMist is set unconditionally here — a device that came from THIS SITE's Mist device
  // list is definitionally in Mist, regardless of what Netbox's own mistdevice/mistdevicesite
  // custom fields (used below for devices Mist didn't report) claim.
  mistDevices.forEach((d) =>
    upsert(d.name, {
      model: d.model,
      ip: d.ip,
      status: d.status,
      type: d.type,
      mac: d.mac,
      serial: d.serial,
      vendor: "Juniper",
      version: d.version,
      uptime: d.uptime,
      mistId: d.id,
      inMist: "Yes",
    }),
  );
  diagramDevices.forEach((d) =>
    upsert(d.name, { vendor: d.vendor, model: d.model, ip: d.ip, status: d.status, version: d.version, uptime: d.uptime }),
  );
  netboxDevices.forEach((d) => {
    const inMist =
      mistSiteId != null ? (!!d.custom?.mistdevice && d.custom?.mistdevicesite === mistSiteId ? "Yes" : "No") : null;
    upsert(d.name, {
      vendor: d.device_type?.manufacturer?.name,
      model: d.device_type?.display,
      ip: d.custom_fields?.ip,
      serial: d.serial,
      polling: d.custom_fields?.POLLING === true ? "Enabled" : d.custom_fields?.POLLING === false ? "Disabled" : null,
      alert: d.custom_fields?.ALERT,
      inMist,
      netboxId: d.id,
    });
  });
  // Opengear devices aren't Mist/diagram-managed, so this is usually the only status source
  // for them — fills the gap left by "Unknown" rather than overriding a real one.
  opengearDevices.forEach((og) => {
    upsert(og.name, { status: og.snmp ? (og.snmp.status === 1 ? "connected" : "disconnected") : null });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Mist reports uptime as a raw seconds count (e.g. 7165905) — render as days/hours/minutes.
function formatUptime(seconds) {
  const s = Number(seconds);
  if (seconds == null || Number.isNaN(s)) return null;
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

const DEVICE_COLUMNS = [
  { key: "name", label: "Device Name" },
  { key: "vendor", label: "Vendor" },
  { key: "model", label: "Model" },
  { key: "ip", label: "IP Address" },
  { key: "status", label: "Status" },
  { key: "type", label: "Type" },
  { key: "serial", label: "Serial" },
  { key: "mac", label: "MAC" },
  { key: "polling", label: "Polling" },
  { key: "alert", label: "Alert" },
  { key: "inMist", label: "In Mist" },
  { key: "version", label: "Version" },
  { key: "uptime", label: "Uptime", format: formatUptime },
];
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "vendor", "model", "ip", "status", "type", "serial"]);
const DEVICE_COLUMNS_STORAGE_KEY = "siteDashboard.deviceColumns";

function loadVisibleColumns() {
  try {
    const raw = localStorage.getItem(DEVICE_COLUMNS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return DEFAULT_VISIBLE_COLUMNS;
}

const DEFAULT_COLUMN_WIDTHS = {
  name: 220,
  vendor: 120,
  model: 160,
  ip: 140,
  status: 110,
  type: 120,
  serial: 140,
  mac: 150,
  polling: 100,
  alert: 100,
  inMist: 90,
  version: 110,
  uptime: 110,
  links: 160,
};
const MIN_COLUMN_WIDTH = 60;
const DEVICE_COLUMN_WIDTHS_STORAGE_KEY = "siteDashboard.deviceColumnWidths";

function loadColumnWidths() {
  try {
    const raw = localStorage.getItem(DEVICE_COLUMN_WIDTHS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COLUMN_WIDTHS;
}

function formatCell(value, column) {
  const formatted = column.format ? column.format(value) : value;
  return formatted || "—";
}

function capitalize(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// "connected" was assumed to be the only online value Mist/the diagram endpoint report, but
// at least one real device came back with "online" instead — that exact-match check treated
// it as offline (red) while the fallback text still displayed capitalize(status) = "Online",
// so the badge read "Online" in red. Matched case-insensitively against both known values now.
// Devices with no live status source stay an explicit "Unknown" rather than being shown as down.
const ONLINE_STATUS_VALUES = new Set(["connected", "online"]);
function StatusBadge({ status }) {
  if (!status) {
    return <span className="text-gray-600 text-xs">Unknown</span>;
  }
  const online = ONLINE_STATUS_VALUES.has(status.toLowerCase());
  return (
    <span className={`text-xs font-medium ${online ? "text-green-400" : "text-red-400"}`}>
      {online ? "Online" : capitalize(status)}
    </span>
  );
}

function DeviceLinks({ device, mistSiteId, snipeitStatus, onSnipeitClick }) {
  const linkClass =
    "text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-blue-400 hover:border-blue-500 transition-colors";
  const canMist = device.mistId && MIST_LINKABLE_TYPES.has(device.type);
  return (
    <div className="flex items-center gap-1">
      {device.netboxId ? (
        <a
          href={`${NETBOX_UI_BASE_URL}/dcim/devices/${device.netboxId}/`}
          target="_blank"
          rel="noreferrer"
          title="Open in Netbox"
          className={linkClass}
        >
          Netbox
        </a>
      ) : null}
      {canMist ? (
        <a
          href={mistDetailUrl(device.mistId, device.type, mistSiteId)}
          target="_blank"
          rel="noreferrer"
          title="Open in Mist"
          className={linkClass}
        >
          Mist
        </a>
      ) : null}
      {device.serial ? (
        <button
          type="button"
          onClick={() => onSnipeitClick(device)}
          disabled={snipeitStatus === "loading"}
          title={snipeitStatus === "error" ? "Not found in Snipeit" : "Open in Snipeit"}
          className={`${linkClass} disabled:opacity-50`}
        >
          {snipeitStatus === "loading" ? "…" : snipeitStatus === "error" ? "Not found" : "Snipeit"}
        </button>
      ) : null}
    </div>
  );
}

function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(c.format ? c.format(r[c.key]) : r[c.key])).join(","));
  return [header, ...lines].join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AllDevicesCard({ netboxDevices, diagram, mist, opengearDevices, mistSiteId, siteCode, getToken }) {  
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);

  // Escape-to-close, since a keyboard user who opens the picker via Enter/Space has no other
  // way to dismiss it (onMouseLeave alone doesn't help them).
  useEffect(() => {
    if (!showColumnPicker) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setShowColumnPicker(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showColumnPicker]);

  // Pointer capture (not a document-level listener) keeps pointermove/pointerup targeting
  // this exact handle even once the cursor drags off its thin hit area — without it, a
  // mouseup that lands back over the header text fires a click there too, which re-triggers
  // the column's sort handler mid-drag.
  const startResize = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startWidth = columnWidths[key] ?? 140;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("select-none");

    const handleMove = (moveEvent) => {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [key]: next }));
    };
    const handleUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      document.body.classList.remove("select-none");
      setColumnWidths((prev) => {
        localStorage.setItem(DEVICE_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
    };
    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleUp);
  };
  const [snipeitStatus, setSnipeitStatus] = useState({});

  // Looked up by serial on click (not prefetched per row) — tab opens synchronously so
  // popup blockers don't kill it while the lookup is in flight.
  const handleSnipeitClick = async (device) => {
    const win = window.open("", "_blank");
    setSnipeitStatus((prev) => ({ ...prev, [device.name]: "loading" }));
    try {
      const token = await getToken();
      const asset = await getSnipeitAssetBySerial(device.serial, token);
      if (!asset?.id) throw new Error("Not found");
      if (win) win.location = `${SNIPEIT_UI_BASE_URL}/hardware/${asset.id}`;
      setSnipeitStatus((prev) => ({ ...prev, [device.name]: null }));
    } catch {
      win?.close();
      setSnipeitStatus((prev) => ({ ...prev, [device.name]: "error" }));
      setTimeout(() => setSnipeitStatus((prev) => ({ ...prev, [device.name]: null })), 3000);
    }
  };

  const merged = useMemo(
    () => mergeDevicesByName(netboxDevices, diagram.devices, mist.devices, mistSiteId, opengearDevices),
    [netboxDevices, diagram.devices, mist.devices, mistSiteId, opengearDevices],
  );

  // Stack members are named like "KSCVICHCSWA0201_0"/"_1" — grouped under the base device
  // only when that base name actually exists as a device itself.
  const grouped = useMemo(() => {
    const byName = new Map(merged.map((d) => [d.name, d]));
    const childrenByParent = new Map();
    const childNames = new Set();
    merged.forEach((d) => {
      const match = d.name.match(/^(.+)_(\d+)$/);
      const parentName = match?.[1];
      if (parentName && parentName !== d.name && byName.has(parentName)) {
        if (!childrenByParent.has(parentName)) childrenByParent.set(parentName, []);
        childrenByParent.get(parentName).push(d);
        childNames.add(d.name);
      }
    });
    return merged
      .filter((d) => !childNames.has(d.name))
      .map((d) => ({
        ...d,
        children: (childrenByParent.get(d.name) || []).sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [merged]);

  const types = useMemo(() => [...new Set(merged.map((d) => d.type).filter(Boolean))].sort(), [merged]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    let list = grouped.filter((g) => {
      const matchesSearch = !q || g.name.toLowerCase().includes(q) || g.children.some((c) => c.name.toLowerCase().includes(q));
      const matchesType = typeFilter === "all" || g.type === typeFilter || g.children.some((c) => c.type === typeFilter);
      return matchesSearch && matchesType;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * dir);
  }, [grouped, search, typeFilter, sortKey, sortDir]);

  const toggleExpanded = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const columns = DEVICE_COLUMNS.filter((c) => visibleColumns.has(c.key));

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(DEVICE_COLUMNS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-400">All Devices</h3>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-gray-500">
              Netbox: <span className="text-gray-300 font-medium">{netboxDevices.length}</span>
            </span>
            <span className="text-gray-500">
              Mist Site:{" "}
              {mistSiteId ? (
                <span className="text-green-400 font-medium">Found</span>
              ) : (
                <span className="text-red-400 font-medium">Not Found</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {diagram.loading && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              Diagram devices…
            </span>
          )}
          {diagram.error && <span className="text-red-400">Diagram: {diagram.error}</span>}
          {mist.loading && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              Mist devices…
            </span>
          )}
          {mist.error && <span className="text-red-400">Mist: {mist.error}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Search devices…"
          aria-label="Search devices"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter devices by type"
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-500"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker((p) => !p)}
            aria-haspopup="true"
            aria-expanded={showColumnPicker}
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Columns
          </button>
          {showColumnPicker && (
            <div
              role="menu"
              className="absolute z-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 space-y-0.5 shadow-xl min-w-[160px]"
              onMouseLeave={() => setShowColumnPicker(false)}
            >
              {DEVICE_COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-xs text-gray-300 px-1 py-0.5 hover:bg-gray-700/50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                    className="accent-pink-500"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() =>
            downloadCsv(
              `${siteCode || "site"}-devices.csv`,
              toCsv(
                rows.flatMap((g) => [g, ...g.children]),
                columns,
              ),
            )
          }
          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors ml-auto"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full divide-y divide-gray-800 text-sm table-fixed">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: columnWidths[c.key] ?? 140 }} />
            ))}
            <col style={{ width: columnWidths.links ?? 160 }} />
            {/* Absorbs whatever width the explicit columns above don't use, so shrinking a
                column doesn't get silently redistributed back across the others, and the
                table doesn't force a horizontal scrollbar just for having explicit widths. */}
            <col />
          </colgroup>
          <thead className="bg-gray-900 text-gray-500">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  tabIndex={0}
                  aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSort(c.key);
                    }
                  }}
                  className="relative text-left px-4 py-2.5 cursor-pointer select-none hover:text-gray-300 whitespace-nowrap overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500"
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
                  <span
                    onPointerDown={startResize(c.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-0 right-0 h-full w-3 cursor-col-resize hover:bg-gray-600/60 touch-none"
                  />
                </th>
              ))}
              <th className="relative text-left px-4 py-2.5 whitespace-nowrap overflow-hidden">
                Links
                <span
                  onPointerDown={startResize("links")}
                  className="absolute top-0 right-0 h-full w-3 cursor-col-resize hover:bg-gray-600/60 touch-none"
                />
              </th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.length > 0 ? (
              rows.flatMap((d) => {
                const hasChildren = d.children.length > 0;
                const isOpen = expanded.has(d.name);
                const parentRow = (
                  <tr key={d.name} className="text-gray-200 hover:bg-gray-800/60">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 overflow-hidden ${c.key === "name" ? "font-medium" : "text-gray-400 truncate"}`}
                      >
                        {c.key === "name" ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            {hasChildren ? (
                              <button
                                onClick={() => toggleExpanded(d.name)}
                                className="text-gray-500 hover:text-gray-200 w-4 shrink-0 text-[10px]"
                              >
                                {isOpen ? "▼" : "▶"}
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <span className="truncate">{d.name}</span>
                            {hasChildren && (
                              <span className="text-[10px] text-gray-600 shrink-0">({d.children.length})</span>
                            )}
                          </span>
                        ) : c.key === "status" ? (
                          <StatusBadge status={d.status} />
                        ) : (
                          formatCell(d[c.key], c)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <DeviceLinks
                        device={d}
                        mistSiteId={mistSiteId}
                        snipeitStatus={snipeitStatus[d.name]}
                        onSnipeitClick={handleSnipeitClick}
                      />
                    </td>
                    <td aria-hidden="true" />
                  </tr>
                );
                if (!isOpen) return [parentRow];
                const childRows = d.children.map((child) => (
                  <tr key={child.name} className="text-gray-400 bg-gray-950/40 hover:bg-gray-800/40">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2 overflow-hidden truncate ${c.key === "name" ? "pl-10" : ""}`}
                      >
                        {c.key === "name" ? (
                          child.name
                        ) : c.key === "status" ? (
                          <StatusBadge status={child.status} />
                        ) : (
                          formatCell(child[c.key], c)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <DeviceLinks
                        device={child}
                        mistSiteId={mistSiteId}
                        snipeitStatus={snipeitStatus[child.name]}
                        onSnipeitClick={handleSnipeitClick}
                      />
                    </td>
                    <td aria-hidden="true" />
                  </tr>
                ));
                return [parentRow, ...childRows];
              })
            ) : (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-6 text-center text-gray-500 italic">
                  No devices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function boolLabel(v) {
  if (v === "true" || v === true) return "Yes";
  if (v === "false" || v === false) return "No";
  return null;
}

// ServiceNow reference fields come back as "" when unset but { link, value } when populated.
function resolveScalar(v) {
  if (v && typeof v === "object") return v.value || "";
  return v ?? "";
}

// Confirmed org-specific scale (from the location's getPriorityString()). "0" is a real,
// meaningful value here ("No Monitoring"), not an empty/unset field — resolved and mapped to
// text *before* Field's own emptiness check runs, since a raw 0 there reads as falsy and
// would otherwise get silently hidden like a genuinely missing value.
const SITE_PRIORITY_LABELS = { 0: "No Monitoring", 1: "Next Business Day", 2: "24/7" };
function sitePriorityLabel(rawValue) {
  const resolved = resolveScalar(rawValue);
  if (resolved === "") return null;
  const s = resolved.toString().trim();
  return SITE_PRIORITY_LABELS[s] ?? resolved;
}

// Appending T00:00:00 forces local-time parsing so a date-only string like "2026-07-01"
// doesn't shift a day earlier in negative-UTC-offset timezones.
function formatFullDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value, format }) {
  const resolved = resolveScalar(value);
  if (!resolved) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-sm text-gray-200 whitespace-nowrap">{format ? format(resolved) : resolved}</p>
    </div>
  );
}

// A sys_user reference field renders as its raw sys_id until userMap resolves it — shows a
// skeleton instead of that hex string for the specific window where resolution is still in
// flight, rather than flashing the id and then swapping to a name.
function ContactField({ label, refField, userMap, loading }) {
  if (!refField) return null;
  const isPending = loading && typeof refField === "object" && !userMap.has(refField.value);
  if (isPending) {
    return (
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
        <div className="h-4 w-24 mt-1 rounded bg-gray-800 animate-pulse" />
      </div>
    );
  }
  return <Field label={label} value={resolveReference(refField, userMap)} />;
}

function SnowLocationCard({ location, error, contacts, userMap, userMapLoading, onRetry }) {
  const [showNotesModal, setShowNotesModal] = useState(false);
  let body;
  if (error) {
    body = <RetryError message={error} onRetry={onRetry} />;
  } else if (!location) {
    body = <p className="text-xs text-gray-500 italic">No ServiceNow location data returned for this site.</p>;
  } else {
    const get = (key) => resolveScalar(location[key]);
    const streetLine = [
      get("u_street_predirectional"),
      get("u_street_number"),
      get("u_street_name"),
      get("u_street_suffix"),
      get("u_street_postdirectional"),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    const cityState = [get("city"), get("state")].filter(Boolean).join(", ").replace(/,\s*$/, "").trim();
    const cityStateZip = [cityState, get("zip")].filter(Boolean).join(" ").trim();
    const country = get("country");
    const streetTwo = get("u_street_2");
    const latLongUrl = get("u_lat_long_url");
    const siteDocUrl = get("u_site_doc_url");
    const hasAddress = streetLine || cityStateZip || country;

    // contacts is a separate record (see getServiceNowLocationBySite) from a different backend
    // endpoint than `location` — description/comments live on that record, not this one.
    const description = contacts && resolveScalar(contacts.u_description);
    const comments = contacts && resolveScalar(contacts.u_comments);
    const hasNotes = description || comments;
    const hasLinks = latLongUrl || siteDocUrl;

    body = (
      <div className="space-y-5">
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">
            <BuildingOfficeIcon className="w-3.5 h-3.5" />
            Site Info
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <Field label="Site Type" value={location.u_site_type} />
            <Field label="Priority" value={sitePriorityLabel(location.u_priority)} />
            <Field label="Active" value={boolLabel(get("u_active"))} />
            <Field label="Time Zone" value={location.time_zone} />
            <Field label="Phone" value={location.phone} />
            <Field
              label="Mobilization Date"
              value={contacts && resolveScalar(contacts.u_network_mob_date)}
              format={formatFullDate}
            />
            <Field
              label="Demobilization Date"
              value={contacts && resolveScalar(contacts.u_network_demob_date)}
              format={formatFullDate}
            />
            {/* u_demob_date (the general job demob date) is a rougher, often-far-future
                estimate compared to the network-specific date above — kept as its own field
                rather than dropped, labeled to make clear it's the less precise one. */}
            <Field label="Estimated Demob Date" value={location.u_demob_date} format={formatFullDate} />
          </div>
        </section>

        {contacts && (
          <section className="border-t border-gray-800 pt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">
              <UsersIcon className="w-3.5 h-3.5" />
              Contacts
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              <ContactField label="Business Contact" refField={contacts.contact} userMap={userMap} loading={userMapLoading} />
              <ContactField
                label="Second Business Contact"
                refField={contacts.u_second_business_contact}
                userMap={userMap}
                loading={userMapLoading}
              />
              <ContactField
                label="IT Contact"
                refField={contacts.u_it_support_contact}
                userMap={userMap}
                loading={userMapLoading}
              />
              <ContactField
                label="On-Site Contact"
                refField={contacts.u_on_site_contact}
                userMap={userMap}
                loading={userMapLoading}
              />
              {/* No field on this record is literally "IT Manager" — u_field_support_manager
                  is the closest role match. Flag if a different field was meant. */}
              <ContactField
                label="Field Support Manager"
                refField={contacts.u_field_support_manager}
                userMap={userMap}
                loading={userMapLoading}
              />
            </div>
          </section>
        )}

        {(hasAddress || hasLinks) && (
          <section className="border-t border-gray-800 pt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">
              <MapPinIcon className="w-3.5 h-3.5" />
              Address
            </h4>
            {hasAddress && (
              <p className="text-sm text-gray-200 uppercase">
                {streetLine || "—"}
                {streetTwo ? `, ${streetTwo}` : ""}
                <br />
                {[cityStateZip, country].filter(Boolean).join(", ") || "—"}
              </p>
            )}
            {hasLinks && (
              <div className="flex items-center gap-4 mt-1.5">
                {latLongUrl && (
                  <a href={latLongUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                    View on map ↗
                  </a>
                )}
                {siteDocUrl && (
                  <a href={siteDocUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                    Site documentation ↗
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        {hasNotes && (
          <section className="border-t border-gray-800 pt-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                Notes
              </h4>
              <button onClick={() => setShowNotesModal(true)} className="text-xs text-blue-400 hover:underline shrink-0">
                Expand ↗
              </button>
            </div>
            <div className="max-h-28 overflow-y-auto pr-1 space-y-1.5">
              {description && <p className="text-sm text-gray-300">{description}</p>}
              {comments && <p className="text-xs text-gray-500 italic">{comments}</p>}
            </div>
          </section>
        )}

        {showNotesModal && (
          <NotesModal description={description} comments={comments} onClose={() => setShowNotesModal(false)} />
        )}
      </div>
    );
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">ServiceNow Location</h3>
      {body}
    </div>
  );
}

// lat/long are often blank, but u_lat_long_url (a Google Maps link) reliably has them
// embedded in its query string — fall back to parsing that.
function extractCoords(location) {
  if (!location) return null;
  const lat = parseFloat(resolveScalar(location.latitude));
  const lon = parseFloat(resolveScalar(location.longitude));
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) return { lat, lon };

  const match = resolveScalar(location.u_lat_long_url).match(/q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (match) {
    const lat2 = parseFloat(match[1]);
    const lon2 = parseFloat(match[2]);
    if (Number.isFinite(lat2) && Number.isFinite(lon2)) return { lat: lat2, lon: lon2 };
  }
  return null;
}

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ heavy hail",
};

const WEATHER_EMOJI = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

// Leaflet's default marker icon path breaks under CRA's webpack bundling — a remote iconUrl
// sidesteps that (same pattern as Map/MapCluster.js).
const siteMarkerIcon = new Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// RainViewer generates radar tiles only up to zoom 7 — "512" gets double pixel-density
// tiles for the sharpest image at that ceiling.
function buildRadarTileUrl(frame) {
  if (!frame) return null;
  return `${frame.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`;
}

function SiteMap({ coords, height, zoom = 15, scrollWheelZoom = false, radarUrl }) {
  return (
    <MapContainer
      center={[coords.lat, coords.lon]}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      style={{ height, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {radarUrl && <TileLayer url={radarUrl} opacity={0.6} zIndex={450} maxNativeZoom={7} />}
      <Marker position={[coords.lat, coords.lon]} icon={siteMarkerIcon} />
    </MapContainer>
  );
}

function SiteMapModal({ coords, radarUrl, onClose }) {
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, onClose);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-map-modal-title"
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="site-map-modal-title" className="text-sm font-semibold text-gray-300">
            Site Location
          </h3>
          <button onClick={onClose} aria-label="Close" className={MODAL_CLOSE_BUTTON_CLASS}>
            &times;
          </button>
        </div>
        <div className="rounded-lg overflow-hidden border border-gray-800">
          <SiteMap coords={coords} height="70vh" zoom={15} scrollWheelZoom radarUrl={radarUrl} />
        </div>
      </div>
    </div>
  );
}

function formatDayLabel(dateStr, { weekday } = {}) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return weekday
    ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function WeatherHistoryModal({ dailyWeather, onClose }) {
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, onClose);
  const days = dailyWeather.slice(-5);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weather-history-modal-title"
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="weather-history-modal-title" className="text-sm font-semibold text-gray-300">
            Last {days.length} Days
          </h3>
          <button onClick={onClose} aria-label="Close" className={MODAL_CLOSE_BUTTON_CLASS}>
            &times;
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {days.map((d) => (
            <div key={d.date} className="rounded-lg p-3 text-center border bg-gray-800 border-gray-700">
              <p className="text-xs text-gray-400 mb-1">{formatDayLabel(d.date, { weekday: true })}</p>
              <p className="text-3xl mb-1">{WEATHER_EMOJI[d.code] || "🌡️"}</p>
              <p className="text-xs text-gray-300 mb-2">{WEATHER_CODES[d.code] || `Code ${d.code}`}</p>
              <p className="text-xs text-gray-200">
                <span className="font-semibold">{d.high != null ? Math.round(d.high) : "—"}°</span>
                <span className="text-gray-500"> / {d.low != null ? Math.round(d.low) : "—"}°</span>
              </p>
              <p className="text-xs text-blue-300 mt-1">
                {d.precip != null ? `${d.precip.toFixed(2)}" precip` : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SiteLocationCard({ location }) {
  const coords = extractCoords(location);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [radarFrame, setRadarFrame] = useState(null);
  const [radarError, setRadarError] = useState(null);
  const [dailyWeather, setDailyWeather] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setWeather(null);
    setWeatherError(null);
    setDailyWeather([]);
    setAlerts([]);
    getCurrentWeather(coords.lat, coords.lon)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch((err) => {
        if (!cancelled) setWeatherError(err.message || "Failed to load weather");
      });
    // Best-effort — a bonus hint, not core data, so no error state surfaced for it.
    getRecentDailyWeather(coords.lat, coords.lon)
      .then((days) => {
        if (!cancelled) setDailyWeather(days);
      })
      .catch(() => {});
    // Also best-effort — no US coverage outside NWS territory just means an empty list.
    getActiveWeatherAlerts(coords.lat, coords.lon)
      .then((a) => {
        if (!cancelled) setAlerts(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lon]);

  const toggleRadar = () => {
    if (!showRadar && !radarFrame && !radarError) {
      getLatestRadarFrame()
        .then(setRadarFrame)
        .catch((err) => setRadarError(err.message || "Failed to load radar"));
    }
    setShowRadar((prev) => !prev);
  };

  if (!coords) return null;

  const radarUrl = showRadar ? buildRadarTileUrl(radarFrame) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-full flex flex-col">
      {alerts.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-900/30 border border-red-600/50 text-red-300 text-xs space-y-1">
          <p className="font-semibold">
            Active NWS Alert{alerts.length > 1 ? "s" : ""} for this location
          </p>
          {alerts.map((a) => (
            <p key={a.id} className="text-red-200">
              {a.event}
              {a.headline ? ` — ${a.headline}` : ""}
            </p>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="text-sm font-semibold text-gray-400">Location</h3>
          {dailyWeather.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              title={weather ? `Current: ${WEATHER_CODES[weather.weathercode] || "Unknown"} — click for recent history` : "View recent weather"}
              className="text-base leading-none px-1.5 py-0.5 rounded-full border bg-gray-800 border-gray-700 hover:border-gray-500 transition-colors"
            >
              {weather ? WEATHER_EMOJI[weather.weathercode] || "🌡️" : "🌤️"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {weather && (
            <span className="text-xs text-gray-300 truncate">
              {Math.round(weather.temperature)}°F · {WEATHER_CODES[weather.weathercode] || "Unknown conditions"} ·{" "}
              {Math.round(weather.windspeed)} mph wind
            </span>
          )}
          {weatherError && <span className="text-xs text-red-400">{weatherError}</span>}
          <button
            onClick={toggleRadar}
            className={`text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
              showRadar
                ? "border-blue-500 text-blue-300 hover:border-blue-400"
                : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            {showRadar ? "Hide Radar" : "Show Radar"}
          </button>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors shrink-0"
          >
            Expand
          </button>
        </div>
      </div>
      {radarError && showRadar && <p className="text-xs text-red-400 mb-2">{radarError}</p>}
      {expanded || showHistory ? (
        <div className="rounded-lg border border-gray-800 flex items-center justify-center text-xs text-gray-500 italic flex-1 min-h-[320px]">
          {expanded ? "Viewing expanded map…" : "Viewing weather history…"}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-800 flex-1 min-h-[320px]">
          <SiteMap coords={coords} height="100%" radarUrl={radarUrl} scrollWheelZoom />
        </div>
      )}
      {expanded && <SiteMapModal coords={coords} radarUrl={radarUrl} onClose={() => setExpanded(false)} />}
      {showHistory && <WeatherHistoryModal dailyWeather={dailyWeather} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

export default function SiteDashboardPage() {
  const { siteCode: rawSiteCode } = useParams();
  const siteCode = (rawSiteCode || "").trim().toUpperCase();
  const getToken = useSiteDashboardToken();
  const navigate = useNavigate();

  // Inline site switcher — lets an engineer jump to another site's dashboard
  // without leaving this page and re-navigating through site search.
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
        // page's actual dashboard data loads independently and isn't blocked by it.
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
    if (trimmed && trimmed !== siteCode) navigate(`/${trimmed}/dashboard`);
  };

  // Bumped by each section's Retry button to force its effect to re-run even though siteCode
  // (its usual trigger) hasn't changed.
  const [dataRetryNonce, setDataRetryNonce] = useState(0);
  const [circuitsRetryNonce, setCircuitsRetryNonce] = useState(0);
  const [incidentsRetryNonce, setIncidentsRetryNonce] = useState(0);

  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snowLocation, setSnowLocation] = useState(null);
  const [snowLoading, setSnowLoading] = useState(true);
  const [snowLocationError, setSnowLocationError] = useState(null);
  // A different backend endpoint/record than snowLocation above — only fetched for the
  // business/IT contact fields that one doesn't carry.
  const [locationRecord, setLocationRecord] = useState(null);
  const [locationRecordLoading, setLocationRecordLoading] = useState(true);
  const [dhcpScopes, setDhcpScopes] = useState([]);
  const [dhcpLoading, setDhcpLoading] = useState(true);
  const [dhcpError, setDhcpError] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [circuitsLoading, setCircuitsLoading] = useState(true);
  const [circuitsError, setCircuitsError] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const [userDisplayMap, setUserDisplayMap] = useState(new Map());
  const [userMapLoading, setUserMapLoading] = useState(true);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState(null);
  const [incidentsDaysAgo, setIncidentsDaysAgo] = useState(INCIDENTS_DEFAULT_DAYS);
  // Split into two independent lists, each filtered by site prefix on its own, and unioned
  // by name below — whichever of the two calls resolves first is what determines the initial
  // device list (a name can come from either source), rather than always waiting on summary
  // specifically. A name-only entry from whichever source hasn't arrived yet just renders
  // with its fields absent/skeletoned until that call catches up.
  const [opengearSummaryDevices, setOpengearSummaryDevices] = useState([]);
  const [opengearLoading, setOpengearLoading] = useState(true);
  const [opengearError, setOpengearError] = useState(null);
  const [opengearStatusDevices, setOpengearStatusDevices] = useState([]);
  const [opengearStatusLoading, setOpengearStatusLoading] = useState(true);
  const opengearDevices = useMemo(() => {
    const summaryByName = new Map(opengearSummaryDevices.map((s) => [(s.name || "").toUpperCase(), s]));
    const statusByName = new Map(opengearStatusDevices.map((s) => [(s.name || "").toUpperCase(), s]));
    const names = new Set([...summaryByName.keys(), ...statusByName.keys()]);
    return Array.from(names)
      .map((key) => {
        const summary = summaryByName.get(key);
        const status = statusByName.get(key);
        return {
          ...summary,
          name: summary?.name || status?.name,
          icmp: status?.icmp ?? null,
          snmp: status?.snmp ?? null,
        };
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [opengearSummaryDevices, opengearStatusDevices]);
  // Only block the card entirely while NEITHER source has produced anything yet — as soon as
  // either one has a device to show, the card mounts and shows per-field skeletons for
  // whichever piece (inventory vs. live status) is still pending. A summary error surfaces
  // immediately rather than waiting on the status call too.
  const opengearInitialLoading =
    !opengearError && (opengearLoading || opengearStatusLoading) && opengearDevices.length === 0;
  const [diagramDevices, setDiagramDevices] = useState([]);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState(null);
  const [mistDevices, setMistDevices] = useState([]);
  const [mistLoading, setMistLoading] = useState(false);
  const [mistError, setMistError] = useState(null);

  // Each section renders as soon as its own fetch resolves rather than waiting on the
  // slowest — they still share one token fetch so switching sites doesn't trigger repeat
  // MSAL popups.
  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    setError(null);
    setData(null);
    setSnowLoading(true);
    setSnowLocation(null);
    setSnowLocationError(null);
    setDhcpLoading(true);
    setDhcpScopes(null);
    setDhcpError(null);
    setOpengearLoading(true);
    setOpengearSummaryDevices([]);
    setOpengearError(null);
    setOpengearStatusLoading(true);
    setOpengearStatusDevices([]);
    (async () => {
      let token;
      try {
        token = await getToken();
      } catch (err) {
        if (cancelled) return;
        const message = err.message || "Authentication failed";
        setError(message);
        setDataLoading(false);
        setSnowLocationError(message);
        setSnowLoading(false);
        setDhcpError(message);
        setDhcpLoading(false);
        setOpengearError(message);
        setOpengearLoading(false);
        setOpengearStatusLoading(false);
        return;
      }
      if (cancelled) return;

      getSiteDashboardData(siteCode, token)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || "Failed to load site dashboard");
        })
        .finally(() => {
          if (!cancelled) setDataLoading(false);
        });

      getSnowLocation(siteCode, token)
        .then((result) => {
          if (!cancelled) setSnowLocation(result);
        })
        .catch((err) => {
          if (!cancelled) setSnowLocationError(err.message || "Failed to load ServiceNow location");
        })
        .finally(() => {
          if (!cancelled) setSnowLoading(false);
        });

      getScopesForSite(siteCode, token)
        .then((result) => {
          if (!cancelled) setDhcpScopes(result);
        })
        .catch((err) => {
          if (!cancelled) setDhcpError(err.message || "Failed to load DHCP scopes");
        })
        .finally(() => {
          if (!cancelled) setDhcpLoading(false);
        });

      // Site code is always the first 8 characters of the device name (e.g. "KSCVICHC" in
      // "KSCVICHCSWA0201") — keep every match since some sites have more than one Opengear.
      // The summary endpoint (netmanid, netboxid, name, model, serial, wiredip, cellip,
      // version, imei, mac, iccid) is the real device inventory; the status endpoint has no
      // inventory info of its own — it's only used for icmp/snmp, the live connection state
      // from the network monitoring tool.
      //
      // These two are fetched independently (not Promise.all'd), and each is filtered by site
      // prefix on its own — whichever resolves first (it varies) populates opengearDevices via
      // the name-union in the useMemo above, instead of always waiting on summary specifically.
      const opengearPrefix = siteCode.slice(0, 8);

      getOpengearSummary(token)
        .then((summaryAll) => {
          if (cancelled) return;
          const matches = (summaryAll || []).filter((og) => (og.name || "").toUpperCase().slice(0, 8) === opengearPrefix);
          setOpengearSummaryDevices(matches);
        })
        .catch((err) => {
          if (!cancelled) setOpengearError(err.message || "Failed to load Opengear devices");
        })
        .finally(() => {
          if (!cancelled) setOpengearLoading(false);
        });

      getOpengearDevices(token)
        .then((statusAll) => {
          if (cancelled) return;
          const matches = (statusAll || []).filter((og) => (og.name || "").toUpperCase().slice(0, 8) === opengearPrefix);
          setOpengearStatusDevices(matches);
        })
        .catch(() => {
          // Non-critical — the summary-derived device list still renders fine without live
          // status; treat "failed" the same as "loaded, nothing found" rather than leaving
          // the skeleton showing forever.
          if (!cancelled) setOpengearStatusDevices([]);
        })
        .finally(() => {
          if (!cancelled) setOpengearStatusLoading(false);
        });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, dataRetryNonce]);

  const retryData = () => setDataRetryNonce((n) => n + 1);

  const netboxSite = data?.netboxbsite;
  const mistSite = data?.mistsite;
  const devices = data?.devices || [];
  const mistSiteId = mistSite?.id;

  // Circuits' `location` filter needs the actual cmn_location sys_id (confirmed by testing
  // that the display-value/site-code string doesn't match — see getCircuitsForSite), so the
  // location record has to resolve first. Originally two separate effects — one fetching the
  // location record, one reacting to it to fetch circuits — but that let the circuits effect
  // read a stale (previous site's) locationRecord/locationRecordLoading for one render right
  // after a site switch, before the location-record effect's own reset had committed. Merged
  // into one sequential effect keyed only on siteCode so there's no window where either piece
  // of state is stale relative to the other.
  useEffect(() => {
    if (!siteCode) return;
    let cancelled = false;
    setLocationRecord(null);
    setLocationRecordLoading(true);
    setCircuits([]);
    setCircuitsError(null);
    setCircuitsLoading(true);
    (async () => {
      let token;
      try {
        token = await getToken();
      } catch (err) {
        if (!cancelled) {
          setLocationRecordLoading(false);
          setCircuitsError(err.message || "Authentication failed");
          setCircuitsLoading(false);
        }
        return;
      }
      let record = null;
      try {
        record = await getServiceNowLocationBySite(siteCode, token);
      } catch {
        record = null;
      }
      if (cancelled) return;
      setLocationRecord(record);
      setLocationRecordLoading(false);

      const locationSysId = record?.sys_id;
      if (!locationSysId) {
        setCircuitsLoading(false);
        return;
      }
      try {
        const result = await getCircuitsForSite(locationSysId, token);
        if (!cancelled) setCircuits(result);
      } catch (err) {
        if (!cancelled) setCircuitsError(err.message || "Failed to load circuits");
      } finally {
        if (!cancelled) setCircuitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, circuitsRetryNonce]);

  const retryCircuits = () => setCircuitsRetryNonce((n) => n + 1);

  // Its own effect (not part of the big siteCode-keyed one above) so widening the days-back
  // window doesn't have to re-fetch DHCP/Opengear/etc. too.
  useEffect(() => {
    if (!siteCode) return;
    let cancelled = false;
    setIncidentsLoading(true);
    setIncidents([]);
    setIncidentsError(null);
    (async () => {
      let token;
      try {
        token = await getToken();
      } catch (err) {
        if (!cancelled) {
          setIncidentsError(err.message || "Authentication failed");
          setIncidentsLoading(false);
        }
        return;
      }
      if (cancelled) return;
      getRecentIncidents(token, incidentsDaysAgo, siteCode)
        .then((result) => {
          if (!cancelled) setIncidents(result);
        })
        .catch((err) => {
          if (!cancelled) setIncidentsError(err.message || "Failed to load incidents");
        })
        .finally(() => {
          if (!cancelled) setIncidentsLoading(false);
        });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, incidentsDaysAgo, incidentsRetryNonce]);

  const retryIncidents = () => setIncidentsRetryNonce((n) => n + 1);

  // getRecentIncidents now does the real site filtering server-side (short_descriptionLIKE in
  // sysparm_query — incidents have no Location field to filter on like circuits do), so this
  // is just a client-side safety net plus the sort. A widened days-back window was previously
  // returning FEWER site-matching incidents than a narrower one, because the old client-only
  // filter ran after the API's flat 200-record cap — a wider window pulled in more org-wide
  // noise while the cap stayed fixed, truncating this site's incidents before they were ever
  // filtered. Filtering server-side means the cap now applies after the site match, so a wider
  // window can only add incidents, never lose them.
  const siteIncidents = useMemo(
    () =>
      incidents
        .filter((i) => (i.short_description || "").toUpperCase().includes(siteCode))
        .sort((a, b) => {
          const dateA = new Date((a.opened_at || a.sys_created_on || "").replace(" ", "T")).getTime();
          const dateB = new Date((b.opened_at || b.sys_created_on || "").replace(" ", "T")).getTime();
          return dateB - dateA;
        }),
    [incidents, siteCode],
  );

  // Resolves whichever of these reference fields still came back as a raw {link, value}
  // sys_id (sysparm_display_value isn't confirmed to be honored on either call it covers)
  // into real names, batched into one users request rather than one per field. Covers both
  // incident people (assigned_to/opened_by/caller_id) and the location record's contacts.
  useEffect(() => {
    const ids = new Set();
    siteIncidents.forEach((inc) => {
      ["assigned_to", "opened_by", "caller_id"].forEach((field) => {
        const ref = inc[field];
        if (ref && typeof ref === "object" && ref.value) ids.add(ref.value);
      });
    });
    if (locationRecord) {
      [
        "contact",
        "u_second_business_contact",
        "u_it_support_contact",
        "u_on_site_contact",
        "u_field_support_manager",
      ].forEach((field) => {
        const ref = locationRecord[field];
        if (ref && typeof ref === "object" && ref.value) ids.add(ref.value);
      });
    }
    if (ids.size === 0) {
      setUserMapLoading(false);
      return;
    }
    let cancelled = false;
    setUserMapLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const users = await getServiceNowUsers(token, [...ids]);
        if (cancelled) return;
        const map = new Map();
        users.forEach((u) => {
          const display = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.user_name || u.email;
          if (display) map.set(u.sys_id, display);
        });
        setUserDisplayMap(map);
      } catch {
        // Non-critical — resolveReference falls back to the raw sys_id.
      } finally {
        if (!cancelled) setUserMapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteIncidents, locationRecord]);

  // Resolved via its own lookup rather than data.netboxbsite.id, which isn't confirmed to be
  // in the same ID space the diagrams endpoint expects.
  useEffect(() => {
    if (!siteCode) {
      setDiagramDevices([]);
      return;
    }
    let cancelled = false;
    setDiagramLoading(true);
    setDiagramError(null);
    setDiagramDevices([]);
    (async () => {
      try {
        const token = await getToken();
        const netboxSiteId = await getNetboxSiteIdByCode(siteCode, token);
        if (!netboxSiteId) {
          if (!cancelled) {
            setDiagramDevices([]);
            setDiagramError("Site not found in Netbox site list");
          }
          return;
        }
        const nodes = await getDiagramDevices(netboxSiteId, token);
        if (!cancelled) setDiagramDevices(nodes);
      } catch (err) {
        if (!cancelled) setDiagramError(err.message || "Failed to load");
      } finally {
        if (!cancelled) setDiagramLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode]);

  useEffect(() => {
    if (!mistSiteId) {
      setMistDevices([]);
      return;
    }
    let cancelled = false;
    setMistLoading(true);
    setMistError(null);
    setMistDevices([]);
    (async () => {
      try {
        const token = await getToken();
        const list = await getMistDevices(mistSiteId, token);
        if (!cancelled) setMistDevices(list);
      } catch (err) {
        if (!cancelled) setMistError(err.message || "Failed to load");
      } finally {
        if (!cancelled) setMistLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistSiteId]);

  return (
    <div className="text-gray-100 max-w-[1600px] mx-auto py-10 px-6 lg:px-10 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold uppercase leading-tight mb-2 pb-4 relative inline-block">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            {netboxSite?.name || siteCode}
          </span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-pink-400 mb-4">Site Dashboard</p>
        <div className="dark text-foreground max-w-xs mx-auto">
          <Autocomplete
            size="sm"
            label="Site Code"
            menuTrigger="input"
            placeholder="Search sites…"
            variant="bordered"
            isLoading={sitesLoading}
            allowsCustomValue
            inputValue={siteInput}
            onInputChange={setSiteInput}
            onSelectionChange={(key) => {
              if (key) {
                // Set immediately rather than waiting on the siteCode-driven effect —
                // the library's own post-selection state update can otherwise race it
                // and leave the input showing blank/placeholder after navigating.
                setSiteInput(key);
                goToSite(key);
              }
            }}
            onKeyDown={(e) => {
              // Only treat Enter as "navigate to this literal typed text" when nothing in the
              // list matches it at all. If any site matches (even a partial, arrow-key-
              // highlighted one), leave Enter to the Autocomplete's own selection handling —
              // otherwise this fired in addition to it, navigating to whatever partial text
              // was still in the box instead of the highlighted suggestion.
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
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm text-center flex items-center justify-center gap-3">
          <span>{error}</span>
          <button
            onClick={retryData}
            className="shrink-0 text-xs px-2 py-0.5 rounded border border-red-400/50 text-red-200 hover:bg-red-900/40 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!dataLoading && !error && !data && (
        <div className="px-4 py-3 rounded-lg bg-yellow-900/30 border border-yellow-600/40 text-yellow-300 text-sm text-center">
          No site found for code "{siteCode}".
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {snowLoading ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={2} />
          </>
        ) : (
          <>
            <SnowLocationCard
              location={snowLocation}
              error={snowLocationError}
              contacts={locationRecord}
              userMap={userDisplayMap}
              userMapLoading={userMapLoading}
              onRetry={retryData}
            />
            <SiteLocationCard location={snowLocation} />
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {opengearInitialLoading ? (
          <OpengearCardSkeleton />
        ) : (
          <OpengearCard
            devices={opengearDevices}
            error={opengearError}
            statusLoading={opengearStatusLoading}
            summaryLoading={opengearLoading}
            onRetry={retryData}
          />
        )}
        <div className="lg:flex-1 lg:min-w-0">
          {dhcpLoading ? (
            <SkeletonTable rows={3} />
          ) : (
            <DhcpScopesCard siteCode={siteCode} scopes={dhcpScopes} error={dhcpError} onRetry={retryData} />
          )}
        </div>
      </div>

      {dataLoading ? (
        <>
          <SkeletonTable rows={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CircuitsCard
              circuits={circuits}
              loading={circuitsLoading}
              error={circuitsError}
              onSelect={setSelectedCircuit}
              onRetry={retryCircuits}
            />
            <IncidentsCard
              incidents={siteIncidents}
              loading={incidentsLoading}
              error={incidentsError}
              onSelect={setSelectedIncident}
              userMap={userDisplayMap}
              daysAgo={incidentsDaysAgo}
              onChangeDaysAgo={setIncidentsDaysAgo}
              onRetry={retryIncidents}
            />
          </div>
          <SkeletonTable rows={5} />
        </>
      ) : (
        data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CircuitsCard
              circuits={circuits}
              loading={circuitsLoading}
              error={circuitsError}
              onSelect={setSelectedCircuit}
              onRetry={retryCircuits}
            />
            <IncidentsCard
              incidents={siteIncidents}
              loading={incidentsLoading}
              error={incidentsError}
              onSelect={setSelectedIncident}
              userMap={userDisplayMap}
              daysAgo={incidentsDaysAgo}
              onChangeDaysAgo={setIncidentsDaysAgo}
              onRetry={retryIncidents}
            />
          </div>

          <AllDevicesCard
            // Remounts on site change so search/type-filter/sort/expanded-row state (plain
            // useState, previously untied to siteCode) doesn't silently carry over from the
            // last site and hide devices at the new one. Column width/visibility prefs are
            // unaffected — those are read from localStorage on init, not component instance.
            key={siteCode}
            netboxDevices={devices}
            diagram={{ devices: diagramDevices, loading: diagramLoading, error: diagramError }}
            mist={{ devices: mistDevices, loading: mistLoading, error: mistError }}
            opengearDevices={opengearDevices}
            mistSiteId={mistSite?.id}
            siteCode={siteCode}
            getToken={getToken}
          />
        </>
      ))}

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          userMap={userDisplayMap}
        />
      )}

      {selectedCircuit && (
        <CircuitDetailModal
          circuit={selectedCircuit}
          locationRecord={locationRecord}
          onClose={() => setSelectedCircuit(null)}
        />
      )}
    </div>
  );
}
