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
