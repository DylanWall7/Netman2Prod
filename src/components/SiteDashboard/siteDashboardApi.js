import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const API_ROOT = `https://${process.env.REACT_APP_API_BASEURL}/api`;
const BASE_URL = `${API_ROOT}/management/netbox`;
const PROVISIONING_BASE_URL = `${API_ROOT}/provisioning`;
const NETBOX_ROOT = `${API_ROOT}/netbox`;
const DHCP_ROOT = `${API_ROOT}/dhcp`;

export async function listSites(token) {
  const res = await fetch(`${BASE_URL}/sites/`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.data || [];
}

export async function getSiteDashboardData(siteCode, token) {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(siteCode)}/devices/`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load site data (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body?.data ? [body] : [];
  return list[0]?.data ?? null;
}

export async function getSnowLocation(siteCode, token) {
  const res = await fetch(`${PROVISIONING_BASE_URL}/snowlocation/${encodeURIComponent(siteCode)}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load ServiceNow location (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return list[0] ?? null;
}

// Uses Open-Meteo's current documented param names (current=..., weather_code,
// wind_speed_unit) — the legacy current_weather=true/windspeed_unit/weathercode aliases
// still work but aren't documented.
export async function getCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load weather (${res.status})`);
  const body = await res.json();
  const current = body?.current;
  if (!current) return null;
  return { temperature: current.temperature_2m, windspeed: current.wind_speed_10m, weathercode: current.weather_code };
}

// Returns raw daily values with no "storm" classification layered on top — Open-Meteo's
// weathercode under-reports real thunderstorms (verified live during one), so any label we
// added would just be a guess.
export async function getRecentDailyWeather(lat, lon, days = 7) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&past_days=${days}&forecast_days=1&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load daily weather history (${res.status})`);
  const body = await res.json();
  const dates = body?.daily?.time || [];
  const codes = body?.daily?.weather_code || [];
  const highs = body?.daily?.temperature_2m_max || [];
  const lows = body?.daily?.temperature_2m_min || [];
  const precip = body?.daily?.precipitation_sum || [];
  return dates.map((date, i) => ({ date, code: codes[i], high: highs[i], low: lows[i], precip: precip[i] }));
}

// Gizmo (legacy) scopes are read-only, unlike Kia — same dual-endpoint pattern as
// Demobe/DemobeStepper.js. Wrapped so a Gizmo hiccup doesn't block Kia data.
export async function getDhcpScopes(siteCode, token) {
  const baseUrl = `https://${process.env.REACT_APP_API_BASEURL}/api`;
  const opts = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
  const [kiaRes, gizmoRes] = await Promise.all([
    fetch(`${baseUrl}/provisioning/dhcp/${siteCode}`, opts),
    fetch(`${baseUrl}/provisioning/dhcp/${siteCode}/gizmo`, opts).catch(() => null),
  ]);
  const kiaData = kiaRes.ok ? await kiaRes.json() : [];
  const gizmoData = gizmoRes?.ok ? await gizmoRes.json() : [];
  return {
    kia: Array.isArray(kiaData) ? kiaData : (kiaData?.scopes ?? []),
    gizmo: Array.isArray(gizmoData) ? gizmoData : (gizmoData?.scopes ?? []),
  };
}

// --- Live Kia DHCP scope chain -------------------------------------------
// Backend contract confirmed by the user 2026-08-25, but field names inside
// each response are NOT yet confirmed — every mapping below is a best-effort
// guess from common Netbox/DHCP-server conventions. Each function logs its
// raw response so the real shape can be read from the console/Network tab
// and this file corrected accordingly. Remove the console.log lines once the
// mappings in getKiaScopesForSite are verified against real data.

export async function getNetboxSiteBrief(siteCode, token) {
  const res = await fetch(
    `${NETBOX_ROOT}/sites/?name__ie=${encodeURIComponent(siteCode)}&brief=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to load site (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] site brief response:", body);
  const list = Array.isArray(body) ? body : body?.results || body?.data || [];
  return list[0] ?? null;
}

export async function getSitePrefixes(siteId, token) {
  const res = await fetch(
    `${NETBOX_ROOT}/prefixes?site_id=${encodeURIComponent(siteId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to load prefixes (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] prefixes response:", body);
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

// `cidr` is the prefix length as a plain number (e.g. 22), not a dotted-decimal
// netmask — confirmed against a real working request (?subnet=...&mask=22).
export async function getDhcpSubnetByCidr(subnet, cidr, token) {
  const res = await fetch(
    `${DHCP_ROOT}/subnetv4?subnet=${encodeURIComponent(subnet)}&mask=${encodeURIComponent(cidr)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const body = await res.json();
  console.log("[DHCP live] subnetv4 by subnet+cidr response:", body);
  const list = Array.isArray(body) ? body : body?.results || body?.data || [body];
  return list[0] ?? null;
}

export async function getDhcpSubnetById(id, token) {
  const res = await fetch(`${DHCP_ROOT}/subnetv4?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  console.log("[DHCP live] subnetv4 by id response:", body);
  const list = Array.isArray(body) ? body : body?.results || body?.data || [body];
  return list[0] ?? null;
}

// Returns every Kia + Gizmo scope for a site in one call, replacing the old
// per-prefix subnetv4 lookup loop. Response shape not yet confirmed —
// logged so the real payload can be captured from the console/Network tab.
export async function getDhcpSiteSummary(siteCode, token) {
  const res = await fetch(`${DHCP_ROOT}/sitesummary/${encodeURIComponent(siteCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load DHCP site summary (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] sitesummary response:", body);
  return body;
}

// Returns every reservation within a subnet. Response shape not yet
// confirmed — logged so the real payload can be captured from the
// console/Network tab.
export async function getReservationsForSubnet(subnet, token) {
  const res = await fetch(`${DHCP_ROOT}/reservationv4?subnet=${encodeURIComponent(subnet)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load reservations (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] reservationv4 response:", body);
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

// Gizmo-specific — keyed by Gizmo's own scopeID (see gizmoId on a scope row),
// not the subnet address reservationv4/Kea use.
export async function getGizmoReservations(gizmoId, token) {
  const res = await fetch(`${DHCP_ROOT}/gizmo/${encodeURIComponent(gizmoId)}/reservations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load reservations (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] gizmo reservations response:", body);
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

export async function getGizmoLeases(gizmoId, token) {
  const res = await fetch(`${DHCP_ROOT}/gizmo/${encodeURIComponent(gizmoId)}/leases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load leases (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] gizmo leases response:", body);
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

// Kea-specific — same REST family as reservationv4/subnetv4 (filterable by
// ip, mac, or subnet; only subnet is used here, same as reservations).
export async function getKeaLeases(subnet, token) {
  const res = await fetch(`${DHCP_ROOT}/leasev4?subnet=${encodeURIComponent(subnet)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load leases (${res.status})`);
  const body = await res.json();
  console.log("[DHCP live] leasev4 response:", body);
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

function cidrToMask(cidr) {
  const bits = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 255).join(".");
}

// Kea and Gizmo use two different option-list conventions, confirmed against
// a real sitesummary response, 2026-08-25:
// - Kea's `optionData`: [{ name: "routers", data: "10.1.2.1" }] — lowercase
//   name, single string value on `data`.
// - Gizmo's `dhcpOptions`: [{ name: "Router", value: ["10.1.2.1"] }] —
//   capitalized name, array value.
function getKeaOption(optionData, name) {
  const opt = Array.isArray(optionData) ? optionData.find((o) => o.name === name) : null;
  return opt?.data ?? null;
}

function getGizmoOptionValues(dhcpOptions, name) {
  const opt = Array.isArray(dhcpOptions) ? dhcpOptions.find((o) => o.name === name) : null;
  return opt?.value ?? null;
}

// Confirmed shape: `pools: [{ pool: "10.145.252.10-10.145.253.244" }]`, a
// "start-end" string. Only the first pool is used — a Kea scope with multiple
// pools will under-report its range until this sums across all of them.
// `pools` itself can be `null` on an otherwise-valid kea_scope.
function firstKeaPoolRange(pools) {
  const first = Array.isArray(pools) ? pools[0] : null;
  const [start, end] = String(first?.pool || "").split("-").map((s) => s.trim());
  return { start: start || null, end: end || null };
}

// Builds one scope row for exactly one server's view of a subnet. `server` is
// "gizmo", "kea", or "none" (not deployed anywhere) — only the fields for
// that server are populated on the input, so the same extraction logic
// naturally produces the right row regardless of which one it is.
function buildScopeRow(cidrKey, prefix, server, { gizmo, gizmoStats, kea, keaStats } = {}) {
  const [subnet, cidrStr] = cidrKey.split("/");
  const cidr = cidrStr ? Number(cidrStr) : null;
  const mask = gizmo?.subnetMask || (cidr !== null ? cidrToMask(cidr) : "—");

  let start = "—";
  let end = "—";
  if (gizmo?.startRange && gizmo?.endRange) {
    start = gizmo.startRange;
    end = gizmo.endRange;
  } else {
    const poolRange = firstKeaPoolRange(kea?.pools);
    start = poolRange.start || "—";
    end = poolRange.end || "—";
  }

  const gizmoRouter = getGizmoOptionValues(gizmo?.dhcpOptions, "Router");
  const gateway =
    (gizmoRouter && gizmoRouter[0]) ||
    getKeaOption(kea?.optionData, "routers") ||
    prefix?.custom_fields?.DEFAULT_GATEWAY ||
    "—";

  const gizmoDns = getGizmoOptionValues(gizmo?.dhcpOptions, "DNS Servers");
  const keaDnsRaw = getKeaOption(kea?.optionData, "domain-name-servers");
  const dns = gizmoDns || (keaDnsRaw ? keaDnsRaw.split(",").map((s) => s.trim()) : []);

  const gizmoDomain = getGizmoOptionValues(gizmo?.dhcpOptions, "DNS Domain Name");
  const domain = (gizmoDomain && gizmoDomain[0]) || getKeaOption(kea?.optionData, "domain-name") || "—";

  // Real usage numbers — Gizmo gives inUse/reserved/percentageUsed directly;
  // Kea gives allocatedAddresses/totalAddresses to compute the same from.
  let leases = 0;
  let reservations = 0;
  let utilization = null;
  if (gizmoStats) {
    leases = Number(gizmoStats.inUse) || 0;
    reservations = Number(gizmoStats.reserved) || 0;
    utilization = Math.round(Number(gizmoStats.percentageUsed) || 0);
  } else if (keaStats) {
    leases = Number(keaStats.allocatedAddresses) || 0;
    utilization =
      keaStats.totalAddresses > 0
        ? Math.round((keaStats.allocatedAddresses / keaStats.totalAddresses) * 100)
        : 0;
  }

  return {
    // Scoped by server so a subnet deployed on both Gizmo and Kea gets two
    // distinct, stable ids rather than colliding on the shared cidrKey.
    id: `${cidrKey}::${server}`,
    scopeId: subnet || "—",
    // Gizmo's own internal scope id — distinct from scopeId (the subnet
    // address above) and required by the /dhcp/gizmo/{id}/... endpoints.
    gizmoId: gizmo?.scopeID ?? null,
    mask,
    cidr,
    name: prefix?.description || gizmo?.name || kea?.userContext?.function || cidrKey || "Unnamed scope",
    start,
    end,
    gateway,
    dns,
    domain,
    leases,
    reservations,
    utilization,
    // A scope deployed nowhere isn't meaningfully "active" or "unknown" the
    // way a deployed-but-unread status would be — it gets its own state.
    // Gizmo's own state (confirmed to include "Inactive", not just "Active")
    // is the only real operational signal we have; Kea has no status field
    // at all. Netbox's prefix status ("active" vs "container") describes the
    // prefix RECORD, not whether a scope is actively serving DHCP — a
    // container prefix's children read "active" too, which is why Kea rows
    // were showing a false "Active" before this was a fallback here. Netbox
    // presence/status is now surfaced separately via hasNetbox/netboxStatus.
    status: server === "none" ? "not_deployed" : gizmo?.state?.toLowerCase() || "unknown",
    hasGizmo: server === "gizmo",
    hasKea: server === "kea",
    hasNetbox: Boolean(prefix),
    netboxStatus: prefix?.status?.value ?? null,
    expanded: false,
  };
}

// The sitesummary response is one object keyed by CIDR string (e.g.
// "10.146.32.0/22"), confirmed 2026-08-25. Each entry independently may or
// may not carry netbox_prefix / gizmo_scope+gizmo_stats / kea_scope+kea_stats.
// Confirmed 2026-08-25: a subnet CAN be deployed on Gizmo and Kea
// simultaneously (e.g. mid-migration) — those are two independent,
// separately-tracked deployments of the same subnet, so each gets its own
// row here rather than being merged into one. This function no longer needs
// a separate Netbox site/prefix call — netbox_prefix, when it exists, is
// already embedded per entry.
export async function getScopesForSite(siteCode, token) {
  const summary = await getDhcpSiteSummary(siteCode, token);
  const scopes = [];

  for (const [cidrKey, entry] of Object.entries(summary || {})) {
    const prefix = entry?.netbox_prefix ?? null;
    const gizmo = entry?.gizmo_scope ?? null;
    const gizmoStats = entry?.gizmo_stats ?? null;
    const kea = entry?.kea_scope ?? null;
    const keaStats = entry?.kea_stats ?? null;

    const hasGizmo = Boolean(gizmo || gizmoStats);
    const hasKea = Boolean(kea || keaStats);

    if (hasGizmo) scopes.push(buildScopeRow(cidrKey, prefix, "gizmo", { gizmo, gizmoStats }));
    if (hasKea) scopes.push(buildScopeRow(cidrKey, prefix, "kea", { kea, keaStats }));
    if (!hasGizmo && !hasKea) scopes.push(buildScopeRow(cidrKey, prefix, "none"));
  }

  // Unlike Gizmo (whose gizmo_stats.reserved gives a real count for free),
  // kea_stats carries no reservation count at all — confirmed 2026-08-25
  // after a Kea row's list count (silently defaulted to 0) didn't match the
  // real count the modal fetched from reservationv4. The only way to get a
  // real number here is to ask reservationv4 directly, per Kea scope.
  await Promise.all(
    scopes
      .filter((s) => s.hasKea)
      .map(async (s) => {
        try {
          const data = await getReservationsForSubnet(s.scopeId, token);
          s.reservations = Array.isArray(data) ? data.length : 0;
        } catch {
          // Leave at 0 rather than failing the whole scope list over one
          // subnet's reservation count.
        }
      })
  );

  return scopes;
}

// /diagrams expects the ID from THIS endpoint, not data.netboxbsite.id from
// /api/management/netbox — the two aren't confirmed to share an ID space.
export async function getNetboxSiteIdByCode(siteCode, token) {
  const res = await fetch(`${API_ROOT}/netbox/sites?brief=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Netbox sites (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body?.results || body?.data || [];
  const match = list.find((s) => (s.name || "").toUpperCase() === siteCode.toUpperCase());
  return match?.id ?? null;
}

// Takes the numeric Netbox site ID, not the site code. Covers most wired devices but not APs.
export async function getDiagramDevices(netboxSiteId, token) {
  const res = await fetch(`${API_ROOT}/diagrams/generate/${encodeURIComponent(netboxSiteId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load diagram devices (${res.status})`);
  const body = await res.json();
  return body?.nodes || [];
}

// Takes the Mist site ID, not the site code or Netbox ID.
export async function getMistDevices(mistSiteId, token) {
  const res = await fetch(`${API_ROOT}/mist/site/${encodeURIComponent(mistSiteId)}/devicesummary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Mist devices (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

// US coverage only — points outside NWS coverage just return an empty features list.
export async function getActiveWeatherAlerts(lat, lon) {
  const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Dashboard/1.0 (placeholder@example.com)", Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`Failed to load weather alerts (${res.status})`);
  const body = await res.json();
  const features = body?.features || [];
  return features.map((f) => ({
    id: f.id,
    event: f.properties?.event,
    headline: f.properties?.headline,
    severity: f.properties?.severity,
    expires: f.properties?.expires,
  }));
}

// No site filter param exists — returns every Opengear device org-wide, callers match by name.
export async function getOpengearDevices(token) {
  const res = await fetch(`${API_ROOT}/reports/opengear/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Opengear devices (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

// Real Opengear inventory list (confirmed 2026-08-27): { netmanid, netboxid, name, model,
// serial, wiredip, cellip, version, imei, mac, iccid } — this is the actual device list/
// metadata source, unlike reports/opengear/status, which only has live connection state
// (no inventory fields of its own). No site filter param exists — org-wide, matched by name.
export async function getOpengearSummary(token) {
  const res = await fetch(`${API_ROOT}/devices/opengear/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Opengear summary (${res.status})`);
  const body = await res.json();
  console.log("[Opengear summary] response:", body);
  return Array.isArray(body) ? body : (body?.data ?? []);
}

export async function getLatestRadarFrame() {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error(`Failed to load radar data (${res.status})`);
  const body = await res.json();
  const frames = body?.radar?.past || [];
  const latest = frames[frames.length - 1];
  if (!latest) return null;
  return { host: body.host, path: latest.path };
}

export function useSiteDashboardToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async () => {
    const request = { ...GizmoRequest, account: accounts[0] };
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      // Redirect, not popup — this app's redirectUri points at the SPA root, so a popup
      // just loads the whole app inside itself instead of closing.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  }, [instance, accounts]);
}
