import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

const BASE_URL = `https://${process.env.REACT_APP_API_BASEURL}/api/depot-orders`;
const RETENTION_DAYS = 60;

const TERMINAL_STATUS = {
  po: "received",
  gear_return: "returned",
  ticket: "completed",
};

export function isTerminal(record) {
  return record.status === TERMINAL_STATUS[record.recordType];
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function unwrapRow(row) {
  const raw = row.data ?? row.DATA;
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { id: row.id, ...data };
}

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return null;
  return res.json();
}

export async function listRecords(token) {
  const body = await request(BASE_URL, { headers: authHeaders(token) });
  const rows = Array.isArray(body) ? body : body?.data ?? [];
  return rows.map(unwrapRow);
}

export async function createRecord(data, token) {
  const row = await request(BASE_URL, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ data }),
  });
  return unwrapRow(row);
}

export async function updateRecord(id, patch, token) {
  const existingRow = await request(`${BASE_URL}/${id}`, { headers: authHeaders(token) });
  const merged = { ...unwrapRow(existingRow), ...patch };
  delete merged.id;
  const row = await request(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ data: merged }),
  });
  return unwrapRow(row);
}

export async function deleteRecord(id, token) {
  await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function pruneCompleted(records, token) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const stale = records.filter(
    (r) => isTerminal(r) && r.completedAt && new Date(r.completedAt).getTime() < cutoff,
  );
  await Promise.allSettled(stale.map((r) => deleteRecord(r.id, token)));
}

export const getPOs = (records) => records.filter((r) => r.recordType === "po");
export const getGearReturns = (records) => records.filter((r) => r.recordType === "gear_return");
export const getTickets = (records) => records.filter((r) => r.recordType === "ticket");
export const getActive = (records) => records.filter((r) => !isTerminal(r));
export const getCompleted = (records) => records.filter((r) => isTerminal(r));

export function useDepotOrdersToken() {
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
