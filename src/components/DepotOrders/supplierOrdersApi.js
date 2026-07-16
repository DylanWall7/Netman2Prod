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

export function useSupplierOrdersToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async () => {
    const request = { ...GizmoRequest, account: accounts[0] };
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      const res = await instance.acquireTokenPopup(request);
      return res.accessToken;
    }
  }, [instance, accounts]);
}
