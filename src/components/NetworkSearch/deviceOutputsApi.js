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

// Multiple components on this page (site list, device outputs, compare) each acquire
// their own token independently. If more than one needs an interactive refresh at the
// same time, MSAL only allows one popup at once — a second call fails immediately with
// "interaction_in_progress". Sharing the in-flight popup promise here means a second
// caller just waits on the first popup's result instead of trying to open its own.
let pendingInteractiveToken = null;

function acquireTokenInteractive(instance, request) {
  if (!pendingInteractiveToken) {
    pendingInteractiveToken = instance.acquireTokenPopup(request).finally(() => {
      pendingInteractiveToken = null;
    });
  }
  return pendingInteractiveToken;
}

export function useNetworkSearchToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async () => {
    const request = { ...GizmoRequest, account: accounts[0] };
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      const res = await acquireTokenInteractive(instance, request);
      return res.accessToken;
    }
  }, [instance, accounts]);
}
