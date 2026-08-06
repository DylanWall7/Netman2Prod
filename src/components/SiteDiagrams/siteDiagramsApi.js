import {
  listNetboxSites,
  useNetworkSearchToken,
} from "../NetworkSearch/deviceOutputsApi";

const BASE_URL = `https://${process.env.REACT_APP_API_BASEURL}/api`;

export { listNetboxSites, useNetworkSearchToken };

export async function generateDiagram(siteId, token) {
  const url = `${BASE_URL}/diagrams/generate/${encodeURIComponent(siteId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to generate diagram (${res.status})`);
  }
  return res.json();
}
