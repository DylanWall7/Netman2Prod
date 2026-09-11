import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const API_ROOT = `https://${process.env.REACT_APP_API_BASEURL}/api`;
const BASE_URL = `${API_ROOT}/management/netbox`;
const PROVISIONING_BASE_URL = `${API_ROOT}/provisioning`;

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
  // This endpoint wraps the record as { status, log, data } with `data` a single object, not an array like most list endpoints here.
  if (Array.isArray(body?.data)) return body.data[0] ?? null;
  if (body?.data && typeof body.data === "object") return body.data;
  return Array.isArray(body) ? body[0] ?? null : null;
}

// Uses Open-Meteo's current documented param names — the legacy aliases still work but aren't documented.
export async function getCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load weather (${res.status})`);
  const body = await res.json();
  const current = body?.current;
  if (!current) return null;
  // timezone=auto piggybacks an IANA zone off this call instead of a separate geo-timezone lookup.
  return {
    temperature: current.temperature_2m,
    windspeed: current.wind_speed_10m,
    weathercode: current.weather_code,
    timezone: body?.timezone || null,
  };
}

// No storm classification layered on — Open-Meteo's weathercode under-reports real thunderstorms, so any label here would be a guess.
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

// /diagrams needs the ID from this endpoint, not data.netboxsite.id — the two aren't confirmed to share an ID space.
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

// A virtual chassis is one devicesummary entry named after the whole stack — pull every physical member's own
// serial out of module_stat too, so each Netbox row for that stack can match live status by serial, not just name.
export function liveMistSerials(liveList) {
  const serials = new Set();
  (liveList || []).forEach((d) => {
    if (d.serial) serials.add(d.serial);
    (d.module_stat || []).forEach((m) => {
      if (m.serial) serials.add(m.serial);
    });
  });
  return serials;
}

// Single-device lookup by serial — avoids devicesummary's per-site stats loop, which 404s the whole request if any one device at the site has no stats yet.
export async function getMistDeviceBySerial(serial, token) {
  const res = await fetch(`${API_ROOT}/mist/device/serial/${encodeURIComponent(serial)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load Mist device (${res.status})`);
  const body = await res.json();
  return body?.data ?? body ?? null;
}

// NWS's feed also carries non-weather public-safety alerts — this keeps only types severe enough to threaten power/network gear.
const IMPACTFUL_WEATHER_ALERT_EVENTS = new Set(
  [
    "Tornado Warning",
    "Severe Thunderstorm Warning",
    "Extreme Wind Warning",
    "High Wind Warning",
    "Ice Storm Warning",
    "Winter Storm Warning",
    "Blizzard Warning",
    "Hurricane Warning",
    "Hurricane Watch",
    "Tropical Storm Warning",
    "Tropical Storm Watch",
    "Storm Surge Warning",
    "Tsunami Warning",
  ].map((e) => e.toLowerCase()),
);

// US coverage only — points outside NWS coverage just return an empty features list.
export async function getActiveWeatherAlerts(lat, lon) {
  const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Dashboard/1.0 (placeholder@example.com)", Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`Failed to load weather alerts (${res.status})`);
  const body = await res.json();
  const features = body?.features || [];
  return features
    .filter((f) => IMPACTFUL_WEATHER_ALERT_EVENTS.has((f.properties?.event || "").toLowerCase()))
    .map((f) => ({
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

// The real device/metadata source — unlike reports/opengear/status, which is connection-state only. No site filter, matched by name.
export async function getOpengearSummary(token) {
  const res = await fetch(`${API_ROOT}/devices/opengear/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Opengear summary (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

const SERVICENOW_ROOT = `${API_ROOT}/servicenow`;

// A zero-match ServiceNow query 404s upstream but surfaces here as an uncaught exception → generic 500, so this sniffs the body for "No Record found" instead of trusting res.status.
async function isNoRecordFoundResponse(res) {
  const text = await res.text().catch(() => "");
  return /no record found/i.test(text);
}

// The network team's ServiceNow assignment_group sys_id — incidents elsewhere aren't ours to surface here.
const NETWORK_ASSIGNMENT_GROUP = "c4b130886f50d1002b018bec5d3ee400";

const INCIDENTS_MAX_DAYS_AGO = 90;

// Incidents have no Location field, so the site match is a sysparm_query text match — doing it server-side (not client-side after the 200 cap) means widening the date window can only add results, never lose them.
export async function getRecentIncidents(token, daysAgo = 30, siteCode = "") {
  const cappedDaysAgo = Math.min(daysAgo, INCIDENTS_MAX_DAYS_AGO);
  const siteFilter = siteCode.trim() ? `^short_descriptionLIKE${siteCode.trim()}` : "";
  // No sysparm_display_value — it gets folded into sysparm_query as a literal field name, which `incident` doesn't have, silently corrupting the query.
  const params = new URLSearchParams({
    assignment_group: NETWORK_ASSIGNMENT_GROUP,
    sysparm_query: `sys_created_on>javascript:gs.daysAgo(${cappedDaysAgo})${siteFilter}`,
    limit: "200",
  });
  const res = await fetch(`${SERVICENOW_ROOT}/incidents?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // A true zero-match query is now possible with server-side site filtering — see isNoRecordFoundResponse above.
  if (res.status === 404 || (res.status === 500 && (await isNoRecordFoundResponse(res)))) return [];
  if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// `location` needs the site's actual sys_id (see getServiceNowLocationBySite), not the site code — ServiceNow treats a bare reference filter as a sys_id match, not a display-value lookup.
// No sysparm_display_value here either — cmdb_ci_circuit has no such field, so it corrupts the query and 404s (doesn't seem to happen on incidents/users).
export async function getCircuitsForSite(locationSysId, token) {
  const params = new URLSearchParams({
    location: locationSysId,
    limit: "200",
  });
  const res = await fetch(`${SERVICENOW_ROOT}/circuits?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // See isNoRecordFoundResponse above — a zero-match query here shows up as a 500, not a 404.
  if (res.status === 404 || (res.status === 500 && (await isNoRecordFoundResponse(res)))) return [];
  if (!res.ok) throw new Error(`Failed to load circuits (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// Normalizes a reference field into whatever's displayable — either a plain string or a {link, value} object, falling back to the raw sys_id.
export function referenceDisplay(field) {
  if (!field) return null;
  if (typeof field === "string") return field || null;
  return field.display_value || field.value || null;
}

// ServiceNow's sys_idIN operator resolves a batch of reference sys_ids in one request instead of one per field per incident.
export async function getServiceNowUsers(token, sysIds) {
  const ids = [...new Set((sysIds || []).filter(Boolean))];
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    sysparm_query: `sys_idIN${ids.join(",")}`,
    limit: String(ids.length),
  });
  const res = await fetch(`${SERVICENOW_ROOT}/users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load ServiceNow users (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// A different record than getSnowLocation returns — used here for the contact/manager fields that one doesn't have. "name" is just the bare site code; the long form is u_display_name.
export async function getServiceNowLocationBySite(siteCode, token) {
  const params = new URLSearchParams({
    name: siteCode,
    limit: "5",
    sysparm_display_value: "true",
  });
  const res = await fetch(`${SERVICENOW_ROOT}/locations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load ServiceNow location record (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body?.result || body?.data || [];
  return list[0] ?? null;
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
      // Full-page redirect, not a popup — a popup would just reload the whole SPA inside itself.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  }, [instance, accounts]);
}
