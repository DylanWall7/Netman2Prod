import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const BASE_URL = `https://${process.env.REACT_APP_API_BASEURL}/api/snipeit`;

export const PO_NUMBER_CUSTOM_FIELD = "_snipeit_ponumber_3";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function safeArray(data) {
  return Array.isArray(data) ? data : data?.data || data?.rows || [];
}

function customFieldValue(device, dbColumnName) {
  const fields = device?.custom_fields;
  if (!fields) return undefined;
  const entry = Object.values(fields).find((f) => f?.field === dbColumnName);
  return entry?.value;
}

async function request(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status === "error") {
    const message = body?.messages || body?.message || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return body;
}

export async function listSnipeitModels(token) {
  const body = await request(`${BASE_URL}/models?limit=500`, { headers: authHeaders(token) });
  return safeArray(body);
}

export async function listSnipeitHardwareByPO(poNumber, token) {
  const url = `${BASE_URL}/hardware?${PO_NUMBER_CUSTOM_FIELD}=${encodeURIComponent(poNumber)}`;
  const body = await request(url, { headers: authHeaders(token) });
  const rows = safeArray(body);
  // Snipe-IT/the proxy doesn't reliably honor this filter param server-side, so
  // re-filter client-side against the actual custom field value as a safety net.
  return rows.filter((d) => String(customFieldValue(d, PO_NUMBER_CUSTOM_FIELD) ?? "") === String(poNumber ?? ""));
}

export async function listSnipeitLocations(token) {
  const body = await request(`${BASE_URL}/locations?limit=500`, { headers: authHeaders(token) });
  return safeArray(body);
}

export async function listSnipeitHardwareByModel(modelId, token) {
  const url = `${BASE_URL}/hardware?model_id=${encodeURIComponent(modelId)}&limit=500`;
  const body = await request(url, { headers: authHeaders(token) });
  return safeArray(body);
}

export async function getSnipeitAssetBySerial(serial, token) {
  const res = await fetch(`${BASE_URL}/hardware/byserial/${encodeURIComponent(serial)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.data || null;
}

export async function createSnipeitAsset(payload, token) {
  return request(`${BASE_URL}/hardware`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function updateSnipeitAsset(serial, payload, token) {
  return request(`${BASE_URL}/hardware/${encodeURIComponent(serial)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function useSnipeitToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async () => {
    const request = { ...GizmoRequest, account: accounts[0] };
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      // Full-page redirect, not a popup — this app's redirectUri points at the SPA root, so
      // a popup just loads the whole app inside itself instead of closing. Redirect reuses
      // the already-registered URI (no Azure changes needed) and navigates the tab away, so
      // this never meaningfully returns — the user lands back freshly authenticated and
      // just retries whatever they were doing.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  }, [instance, accounts]);
}
