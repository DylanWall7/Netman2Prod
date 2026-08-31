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

// NWS's alerting system also carries non-meteorological public-safety messages (air quality,
// civil/emergency messages, amber alerts, etc.) through the same feed — not weather, so this
// card (which exists to flag actual weather conditions at a site) filters them out.
const NON_WEATHER_ALERT_EVENTS = new Set(
  [
    "Air Quality Alert",
    "Administrative Message",
    "Test Message",
    "Civil Danger Warning",
    "Civil Emergency Message",
    "Child Abduction Emergency",
    "Earthquake Warning",
    "Evacuation Immediate",
    "Fire Warning",
    "Hazardous Materials Warning",
    "Law Enforcement Warning",
    "Local Area Emergency",
    "Nuclear Power Plant Warning",
    "Radiological Hazard Warning",
    "Shelter In Place Warning",
    "Volcano Warning",
    "911 Telephone Outage Emergency",
    "Telephone Outage Emergency",
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
    .filter((f) => !NON_WEATHER_ALERT_EVENTS.has((f.properties?.event || "").toLowerCase()))
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

const SERVICENOW_ROOT = `${API_ROOT}/servicenow`;

// This backend doesn't preserve ServiceNow's own status code on a query that legitimately
// matches zero rows: ServiceNow's raw table API returns 404 "No Record found", but that
// surfaces here as an uncaught GuzzleHttp\Exception\ClientException in the Laravel controller.
// Since that exception class doesn't extend Laravel's HttpException, the default handler can't
// tell it apart from a real crash and returns a generic 500 with a full debug-page HTML body —
// confirmed via a real Network-tab response (status 500, "No Record found" embedded in the
// dumped exception message). So this sniffs the response body for that message instead of
// trusting res.status, which is always 500 for this case regardless of the real cause.
async function isNoRecordFoundResponse(res) {
  const text = await res.text().catch(() => "");
  return /no record found/i.test(text);
}

// The network team's ServiceNow assignment_group sys_id — incidents assigned elsewhere
// aren't ours to surface on a network dashboard.
const NETWORK_ASSIGNMENT_GROUP = "c4b130886f50d1002b018bec5d3ee400";

const INCIDENTS_MAX_DAYS_AGO = 90;

// Confirmed (2026-08-28): incidents have no Location field, so the site match has to be a
// short_description text match either way (no field-based filter like circuits' `location=`
// is available). Previously this ran client-side AFTER fetching 200 org-wide incidents —
// which meant a WIDER days-back window could return FEWER site-matching incidents than a
// narrower one, since a wider window pulls in more org-wide noise while the 200-record cap
// stays fixed, truncating away this site's incidents before the site filter ever saw them.
// Moving the site match into sysparm_query means the 200 cap applies to already-site-filtered
// results, so widening the window can only ever add incidents, never lose them.
export async function getRecentIncidents(token, daysAgo = 30, siteCode = "") {
  const cappedDaysAgo = Math.min(daysAgo, INCIDENTS_MAX_DAYS_AGO);
  const siteFilter = siteCode.trim() ? `^short_descriptionLIKE${siteCode.trim()}` : "";
  // No sysparm_display_value here — confirmed on the circuits endpoint that this backend
  // folds every non-sysparm_query param into one big AND-chained sysparm_query string
  // (`assignment_group=X^sysparm_display_value=true`), and `incident` has no field literally
  // called sysparm_display_value, so it silently corrupted the query and dropped real matches.
  // Reference fields (assigned_to/opened_by/caller_id) just come back as {link, value} instead
  // — already handled by referenceDisplay()/resolveReference() either way.
  const params = new URLSearchParams({
    assignment_group: NETWORK_ASSIGNMENT_GROUP,
    sysparm_query: `sys_created_on>javascript:gs.daysAgo(${cappedDaysAgo})${siteFilter}`,
    limit: "200",
  });
  const res = await fetch(`${SERVICENOW_ROOT}/incidents?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Filtering by site server-side (siteFilter above) made a true zero-match query possible
  // for the first time here — see isNoRecordFoundResponse above for why that shows up as a
  // 500, not a 404.
  if (res.status === 404 || (res.status === 500 && (await isNoRecordFoundResponse(res)))) return [];
  if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
  const body = await res.json();
  console.log("[ServiceNow] incidents response:", body);
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// The swagger claims `location` takes either a sys_id or display value, but confirmed by
// testing: passing the site code (the display value) 404s with "No Record found" — ServiceNow
// treats a bare reference-field filter as a sys_id match, not a display-value lookup, so this
// needs the location record's actual sys_id (see getServiceNowLocationBySite/locationRecord),
// not the site code string.
//
// No sysparm_display_value here — confirmed via a real error response that this backend
// folds every non-sysparm_query param into one big AND-chained sysparm_query string
// (`location=X^sysparm_display_value=true`) rather than forwarding it as ServiceNow's own
// reserved param. cmdb_ci_circuit has no field literally called "sysparm_display_value", so
// that corrupts the query and ServiceNow 404s — this doesn't seem to happen on incidents/
// users, so left alone there.
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
  console.log("[ServiceNow] circuits response:", body);
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// ServiceNow reference fields (assigned_to, opened_by, caller_id, etc.) come back as either
// a plain display-name string (when sysparm_display_value is honored) or a {link, value}
// object where value is just a sys_id (when it isn't) — this normalizes both into whatever's
// actually displayable, falling back to the raw sys_id rather than showing nothing.
export function referenceDisplay(field) {
  if (!field) return null;
  if (typeof field === "string") return field || null;
  return field.display_value || field.value || null;
}

// ServiceNow's "sys_idIN val1,val2,..." encoded-query operator, passed through sysparm_query
// (the one raw-passthrough filter this endpoint documents) — resolves a batch of reference
// sys_ids (assigned_to, opened_by, caller_id, etc. on an incident) in a single request rather
// than one per field per incident.
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
  console.log("[ServiceNow] users response:", body);
  return Array.isArray(body) ? body : body?.result || body?.data || [];
}

// Confirmed against a real payload (2026-08-28): "name" is just the bare site code (e.g.
// "AERAZFAB") — the longer "SITECODE - description - City, ST" string is a separate
// u_display_name field. This is a *different* record from the one getSnowLocation returns (a
// different backend endpoint entirely) — used here specifically for the contact/manager
// reference fields that one doesn't have.
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
  console.log("[ServiceNow] locations response:", body);
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
      // Redirect, not popup — this app's redirectUri points at the SPA root, so a popup
      // just loads the whole app inside itself instead of closing.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  }, [instance, accounts]);
}
