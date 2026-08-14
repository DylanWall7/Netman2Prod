import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const API_ROOT = `https://${process.env.REACT_APP_API_BASEURL}/api`;
const BASE_URL = `${API_ROOT}/management/netbox`;
const PROVISIONING_BASE_URL = `${API_ROOT}/provisioning`;

// Plain array of site objects, same as ManageDevicePage/DepotOrders SiteAutocomplete use —
// site.name here is the same siteCode value the dashboard route expects.
export async function listSites(token) {
  const res = await fetch(`${BASE_URL}/sites/`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.data || [];
}

// Same shape ManageDevicePage relies on: an array of { data: { netboxbsite, mistsite, devices } },
// one entry per matched site. A siteCode lookup only ever matches one site.
export async function getSiteDashboardData(siteCode, token) {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(siteCode)}/devices/`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load site data (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body?.data ? [body] : [];
  return list[0]?.data ?? null;
}

// `data` here is an array of matching ServiceNow location records — a siteCode lookup
// only ever matches one.
export async function getSnowLocation(siteCode, token) {
  const res = await fetch(`${PROVISIONING_BASE_URL}/snowlocation/${encodeURIComponent(siteCode)}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load ServiceNow location (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return list[0] ?? null;
}

// Open-Meteo is a free, keyless public API — no auth header needed here. Uses the current
// documented parameter names (current=..., weather_code, wind_speed_unit) per
// open-meteo.com/en/docs — the legacy current_weather=true/windspeed_unit/weathercode
// aliases still work but aren't in the current docs, so avoid relying on undocumented behavior.
export async function getCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load weather (${res.status})`);
  const body = await res.json();
  const current = body?.current;
  if (!current) return null;
  return { temperature: current.temperature_2m, windspeed: current.wind_speed_10m, weathercode: current.weather_code };
}

// `past_days` on the same Forecast API returns recent history alongside the forecast, so no
// separate historical endpoint is needed. Returns the daily values as Open-Meteo reports
// them — condition code, high/low, and total precipitation — with no classification or
// filtering applied on top. (Deliberately not trying to label days as "storms": Open-Meteo's
// own weathercode under-reports actual thunderstorms — verified live against Chicago during
// a real storm, where it returned "heavy rain" instead — so any judgment call we layered on
// top of that would just be a guess dressed up as data. Showing the real numbers and letting
// a human read them is more honest.)
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

// Older sites' DHCP scopes live in a legacy system ("Gizmo") this app can only read, not
// manage — same dual-endpoint pattern already used in Demobe/DemobeStepper.js. The gizmo
// call is wrapped so a legacy-system hiccup doesn't block the primary (Kia) data, and both
// responses may come back as a bare array or `{ scopes: [...] }`.
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

// SiteDiagramsView.js resolves its numeric site ID from THIS endpoint (/api/netbox/sites),
// not the /api/management/netbox one we use elsewhere on this page — the two aren't
// confirmed to share an ID space, so look this up independently rather than assuming
// data.netboxbsite.id from the other endpoint is valid here.
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

// Same endpoint /diagrams uses to build the topology view — takes the numeric Netbox site
// ID (not the site code). Covers most wired devices but not APs, per how that page is used.
export async function getDiagramDevices(netboxSiteId, token) {
  const res = await fetch(`${API_ROOT}/diagrams/generate/${encodeURIComponent(netboxSiteId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load diagram devices (${res.status})`);
  const body = await res.json();
  return body?.nodes || [];
}

// Same devicesummary endpoint Topology/topologyView.js uses — takes the Mist site ID (not
// the site code or Netbox ID), and already includes name/model/ip/status/type per device
// directly, no need for the per-device /details lookup topologyView also does for its own
// link-building purposes.
export async function getMistDevices(mistSiteId, token) {
  const res = await fetch(`${API_ROOT}/mist/site/${encodeURIComponent(mistSiteId)}/devicesummary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Mist devices (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

// NOAA/NWS's alerts endpoint returns actual official warnings issued for a point — not a
// classification we're inferring, the real thing. US coverage only; points outside NWS
// coverage just come back with an empty features list. NWS asks for an identifying
// User-Agent header, though browsers silently ignore any custom value fetch() sets there —
// harmless either way, since NWS doesn't reject requests over it.
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

// Same endpoint OpengearReports.js uses — no site filter param exists, it returns every
// Opengear device across the whole org, so we fetch once and match by name client-side.
// Site codes appear as a prefix/substring in device names elsewhere in this app (switches,
// APs), and some sites have more than one Opengear, so callers should match all devices
// whose name contains the site code, not assume a single result.
export async function getOpengearDevices(token) {
  const res = await fetch(`${API_ROOT}/reports/opengear/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load Opengear devices (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

// RainViewer is a free, keyless public API for radar tile imagery. This index endpoint
// lists recent radar frames; we only need the most recent one for a "current radar" overlay.
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
      // Silent (iframe-based) renewal failed — fall back to a full-page redirect rather than
      // a popup. Popups are broken here: this app's redirectUri points at the SPA root, so a
      // popup just loads the whole app inside itself instead of closing (a known MSAL issue,
      // worsened by browsers increasingly partitioning storage between a popup and its
      // opener). A redirect needs no new Azure AD redirect-URI registration since it reuses
      // the one already configured. It navigates the tab away, so this never meaningfully
      // returns — the user lands back in the app freshly authenticated and just retries
      // whatever they were doing.
      await instance.acquireTokenRedirect(request);
      return null;
    }
  }, [instance, accounts]);
}
