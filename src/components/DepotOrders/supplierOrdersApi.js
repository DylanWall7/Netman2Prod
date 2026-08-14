import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const BASE_URL = `https://${process.env.REACT_APP_API_BASEURL}/api/netbox/orders`;

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status})${body ? `: ${body}` : ""}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listSupplierOrders(token) {
  const body = await request(BASE_URL, { headers: authHeaders(token) });
  return Array.isArray(body) ? body : body?.data ?? [];
}

export async function createSupplierOrder(row, token) {
  return request(BASE_URL, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(row),
  });
}

export async function updateSupplierOrder(id, row, token) {
  return request(`${BASE_URL}/${id}/`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(row),
  });
}

export async function deleteSupplierOrder(id, token) {
  const res = await fetch(`${BASE_URL}/${id}/`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status})${body ? `: ${body}` : ""}`);
  }
}

export function useSupplierOrdersToken() {
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
      await instance.acquireTokenRedirect(request);
      return null;
    }
  }, [instance, accounts]);
}
