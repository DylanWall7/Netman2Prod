import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
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
  getSiteDashboardData,
  getSnowLocation,
  listSites,
  useSiteDashboardToken,
} from "./siteDashboardApi";
import { getSnipeitAssetBySerial } from "../DepotOrders/snipeitApi";

const NETBOX_UI_BASE_URL = "https://netbox.kiewit.com";
const SNIPEIT_UI_BASE_URL = "https://netinv.kiewitplaza.com";

const MIST_LINKABLE_TYPES = new Set(["switch", "gateway", "router", "ap"]);

function mistDetailUrl(mistId, type, mistSiteId) {
  const orgId = process.env.REACT_APP_MIST_ORG_ID;
  const mistType = type === "gateway" || type === "router" ? "gateway" : type === "ap" ? "ap" : "switch";
  return `https://manage.mist.com/admin/?org_id=${orgId}#!${mistType}/detail/${mistId}/${mistSiteId ?? ""}`;
}

function ComingSoonCard({ title, note }) {
  return (
    <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-5 flex flex-col justify-between min-h-[140px]">
      <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
      <p className="text-xs text-gray-600 mt-2">{note}</p>
    </div>
  );
}

function SkeletonBar({ className }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />;
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

function DhcpScopesCard({ siteCode, scopes, error }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400">DHCP Scopes</h3>
        <Link to={`/dhcp/${siteCode}`} className="text-xs text-pink-500 hover:text-pink-400">
          Manage DHCP →
        </Link>
      </div>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : scopes.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No DHCP scopes found for this site.</p>
      ) : (
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
              {scopes.map((s) => (
                <DhcpScopeRow key={s.id} scope={s} />
              ))}
            </tbody>
          </table>
        </div>
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

function OpengearCard({ devices, error, statusLoading, summaryLoading }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full max-w-sm flex-shrink-0">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Opengear</h3>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : devices.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No Opengear devices found for this site.</p>
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

function formatCell(value, column) {
  const formatted = column.format ? column.format(value) : value;
  return formatted || "—";
}

// "connected" is the only online value Mist/the diagram endpoint report — devices with no
// live status source stay an explicit "Unknown" rather than being shown as down.
function StatusBadge({ status }) {
  if (!status) {
    return <span className="text-gray-600 text-xs">Unknown</span>;
  }
  const online = status === "connected";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? "text-green-400" : "text-red-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? "bg-green-500" : "bg-red-500"}`} />
      {online ? "Online" : status}
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
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
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Columns
          </button>
          {showColumnPicker && (
            <div
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
        <table className="min-w-full divide-y divide-gray-800 text-sm">
          <thead className="bg-gray-900 text-gray-500">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="text-left px-4 py-2.5 cursor-pointer select-none hover:text-gray-300 whitespace-nowrap"
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              <th className="text-left px-4 py-2.5 whitespace-nowrap">Links</th>
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
                      <td key={c.key} className={`px-4 py-2.5 ${c.key === "name" ? "font-medium" : "text-gray-400"}`}>
                        {c.key === "name" ? (
                          <span className="flex items-center gap-1.5">
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
                            {d.name}
                            {hasChildren && <span className="text-[10px] text-gray-600">({d.children.length})</span>}
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
                  </tr>
                );
                if (!isOpen) return [parentRow];
                const childRows = d.children.map((child) => (
                  <tr key={child.name} className="text-gray-400 bg-gray-950/40 hover:bg-gray-800/40">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-2 ${c.key === "name" ? "pl-10" : ""}`}>
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
                  </tr>
                ));
                return [parentRow, ...childRows];
              })
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-500 italic">
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
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-200">{format ? format(resolved) : resolved}</p>
    </div>
  );
}

function SnowLocationCard({ location, error }) {
  let body;
  if (error) {
    body = <p className="text-xs text-red-400">{error}</p>;
  } else if (!location) {
    body = <p className="text-xs text-gray-600 italic">No ServiceNow location data returned for this site.</p>;
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

    body = (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Field label="Site Type" value={location.u_site_type} />
          <Field label="Priority" value={location.u_priority} />
          <Field label="Active" value={boolLabel(get("u_active"))} />
          <Field label="Time Zone" value={location.time_zone} />
          <Field label="Phone" value={location.phone} />
          <Field label="Mobilization Date" value={location.u_mob_date} format={formatFullDate} />
          <Field label="Demobilization Date" value={location.u_demob_date} format={formatFullDate} />
        </div>

        {hasAddress && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Address</p>
            <p className="text-sm text-gray-200 uppercase">
              {streetLine || "—"}
              {streetTwo ? `, ${streetTwo}` : ""}
              <br />
              {[cityStateZip, country].filter(Boolean).join(", ") || "—"}
            </p>
            {latLongUrl && (
              <a href={latLongUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                View on map ↗
              </a>
            )}
          </div>
        )}

        {siteDocUrl && (
          <a
            href={siteDocUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:underline block"
          >
            Site documentation ↗
          </a>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Site Location</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none">
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
  const days = dailyWeather.slice(-5);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Last {days.length} Days</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none">
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
        <div className="rounded-lg border border-gray-800 flex items-center justify-center text-xs text-gray-600 italic" style={{ height: 320 }}>
          {expanded ? "Viewing expanded map…" : "Viewing weather history…"}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-800" style={{ height: 320 }}>
          <SiteMap coords={coords} height="100%" radarUrl={radarUrl} scrollWheelZoom={showRadar} />
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

  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snowLocation, setSnowLocation] = useState(null);
  const [snowLoading, setSnowLoading] = useState(true);
  const [snowLocationError, setSnowLocationError] = useState(null);
  const [dhcpScopes, setDhcpScopes] = useState([]);
  const [dhcpLoading, setDhcpLoading] = useState(true);
  const [dhcpError, setDhcpError] = useState(null);
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
      // Confirmed 2026-08-27: the summary endpoint (netmanid, netboxid, name, model, serial,
      // wiredip, cellip, version, imei, mac, iccid) is the real device inventory; the status
      // endpoint has no inventory info of its own — it's only used for icmp/snmp, the live
      // connection state from the network monitoring tool.
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
  }, [siteCode]);

  const netboxSite = data?.netboxbsite;
  const mistSite = data?.mistsite;
  const devices = data?.devices || [];
  const mistSiteId = mistSite?.id;

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
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm text-center">
          {error}
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
            <SnowLocationCard location={snowLocation} error={snowLocationError} />
            <SiteLocationCard location={snowLocation} />
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {opengearInitialLoading ? (
          <SkeletonTable rows={2} />
        ) : (
          <OpengearCard
            devices={opengearDevices}
            error={opengearError}
            statusLoading={opengearStatusLoading}
            summaryLoading={opengearLoading}
          />
        )}
        <div className="lg:flex-1 lg:min-w-0">
          {dhcpLoading ? (
            <SkeletonTable rows={3} />
          ) : (
            <DhcpScopesCard siteCode={siteCode} scopes={dhcpScopes} error={dhcpError} />
          )}
        </div>
      </div>

      {dataLoading ? (
        <>
          <SkeletonTable rows={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComingSoonCard title="Circuits" note="Work in progress." />
            <ComingSoonCard
              title="Recent Tickets / Outages"
              note="Work in progress."
            />
          </div>
          <SkeletonTable rows={5} />
        </>
      ) : (
        data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComingSoonCard title="Circuits" note="Work in progress." />
            <ComingSoonCard
              title="Recent Tickets / Outages"
              note="Work in progress."
            />
          </div>

          <AllDevicesCard
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
    </div>
  );
}
