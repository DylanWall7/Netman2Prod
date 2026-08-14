import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const BASE_URL = `https://${process.env.REACT_APP_API_BASEURL}/api`;

export async function getDeviceOutputs(netboxId, token, { latest = false } = {}) {
  const params = new URLSearchParams({ netbox_id: netboxId });
  if (latest) params.set("latest", "true");
  const url = `${BASE_URL}/outputs?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to load outputs (${res.status})`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : body?.data || body?.rows || [];
}

function safeList(body) {
  return Array.isArray(body) ? body : body?.results || body?.data || body?.rows || [];
}

export async function listNetboxSites(token) {
  const res = await fetch(`${BASE_URL}/netbox/sites?brief=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
  return safeList(await res.json());
}

export async function listNetboxDevicesForSite(siteId, token) {
  const url = `${BASE_URL}/netbox/devices?site_id=${encodeURIComponent(siteId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to load devices (${res.status})`);
  return safeList(await res.json());
}

export function useNetworkSearchToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async () => {
    const request = { ...GizmoRequest, account: accounts[0] };
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      // Full-page redirect, not a popup — this app's redirectUri points at the SPA root, so
      // a popup just loads the whole app inside itself instead of closing (known MSAL issue,
      // worsened by browsers partitioning storage between popup and opener). Redirect reuses
      // the already-registered URI, no Azure changes needed. Navigates the tab away, so this
      // never meaningfully returns — the user lands back in the app freshly authenticated
      // and just retries whatever they were doing.
      await instance.acquireTokenRedirect(request);
      return null;
    }
  }, [instance, accounts]);
}
