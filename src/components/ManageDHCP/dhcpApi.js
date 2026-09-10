const API_ROOT = `https://${process.env.REACT_APP_API_BASEURL}/api`;
const NETBOX_ROOT = `${API_ROOT}/netbox`;
const DHCP_ROOT = `${API_ROOT}/dhcp`;

// Deletes by network address + prefix length — the scope's own `id` is synthetic, not a real Kea subnet id.
export async function deleteSubnet(subnet, cidr, token) {
  const res = await fetch(`${DHCP_ROOT}/subnetv4/${encodeURIComponent(subnet)}/${encodeURIComponent(cidr)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to delete scope (${res.status})`);
  return res.json();
}

// Kea's API takes an array even for one subnet — wrapped here so callers don't have to.
export async function createSubnet(payload, token) {
  const res = await fetch(`${DHCP_ROOT}/subnetv4`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([payload]),
  });
  if (!res.ok) throw new Error(`Failed to deploy scope (${res.status})`);
  return res.json();
}

// shared-network-name isn't in the generate response but Kea's create API requires it.
export function buildKeaDeployPayload(params, start, end) {
  return {
    ...params,
    "shared-network-name": params["shared-network-name"] ?? null,
    pools: [{ ...(params.pools?.[0] || {}), pool: `${start.trim()}-${end.trim()}` }],
  };
}

// Pre-fills the deploy-to-Kea form for a not-yet-deployed Netbox prefix.
export async function generateDhcpScopeParams(netboxPrefixId, token) {
  const res = await fetch(`${NETBOX_ROOT}/prefixes/${encodeURIComponent(netboxPrefixId)}/dhcp/generate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to generate scope parameters (${res.status})`);
  return res.json();
}

// Returns every Kea + Gizmo scope for a site in one call.
export async function getDhcpSiteSummary(siteCode, token) {
  const res = await fetch(`${DHCP_ROOT}/sitesummary/${encodeURIComponent(siteCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 is a real, common state, not a transient failure — flagged so callers can tell them apart.
  if (res.status === 404) {
    const err = new Error("Site not found in Netbox.");
    err.siteNotFound = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Failed to load DHCP site summary (${res.status})`);
  return res.json();
}

// Returns every reservation within a subnet.
export async function getReservationsForSubnet(subnet, token) {
  const res = await fetch(`${DHCP_ROOT}/reservationv4?subnet=${encodeURIComponent(subnet)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load reservations (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

// reservationv4 is Kea-specific — these calls never touch a Gizmo reservation.
export async function createReservation({ ipaddress, hwaddress, description }, token) {
  const res = await fetch(`${DHCP_ROOT}/reservationv4`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ipaddress, hwaddress, description }),
  });
  if (!res.ok) throw new Error(`Failed to create reservation (${res.status})`);
  return res.json();
}

export async function updateReservation({ ipaddress, hwaddress, description }, token) {
  const res = await fetch(`${DHCP_ROOT}/reservationv4`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ipaddress, hwaddress, description }),
  });
  if (!res.ok) throw new Error(`Failed to update reservation (${res.status})`);
  return res.json();
}

export async function deleteReservationByIp(ip, token) {
  const res = await fetch(`${DHCP_ROOT}/reservationv4/ip/${encodeURIComponent(ip)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to delete reservation (${res.status})`);
  return res.json();
}

// Gizmo-specific — keyed by its own scopeID, not the subnet address Kea uses.
export async function getGizmoReservations(gizmoId, token) {
  const res = await fetch(`${DHCP_ROOT}/gizmo/${encodeURIComponent(gizmoId)}/reservations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load reservations (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

export async function getGizmoLeases(gizmoId, token) {
  const res = await fetch(`${DHCP_ROOT}/gizmo/${encodeURIComponent(gizmoId)}/leases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load leases (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

// Kea-specific, same REST family as reservationv4/subnetv4 — filtered by subnet only.
export async function getKeaLeases(subnet, token) {
  const res = await fetch(`${DHCP_ROOT}/leasev4?subnet=${encodeURIComponent(subnet)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load leases (${res.status})`);
  const body = await res.json();
  return Array.isArray(body) ? body : body?.results || body?.data || [];
}

function cidrToMask(cidr) {
  const bits = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 255).join(".");
}

// Kea's optionData is lowercase name + string data; Gizmo's dhcpOptions is capitalized name + array value.
function getKeaOption(optionData, name) {
  const opt = Array.isArray(optionData) ? optionData.find((o) => o.name === name) : null;
  return opt?.data ?? null;
}

function getGizmoOptionValues(dhcpOptions, name) {
  const opt = Array.isArray(dhcpOptions) ? dhcpOptions.find((o) => o.name === name) : null;
  return opt?.value ?? null;
}

// First pool only — a scope with multiple Kea pools under-reports its range; pools can be null.
export function firstKeaPoolRange(pools) {
  const first = Array.isArray(pools) ? pools[0] : null;
  const [start, end] = String(first?.pool || "").split("-").map((s) => s.trim());
  return { start: start || null, end: end || null };
}

// One row per server's view of a subnet — same extraction logic for gizmo/kea/none.
function buildScopeRow(cidrKey, prefix, server, { gizmo, gizmoStats, kea, keaStats } = {}) {
  const [subnet, cidrStr] = cidrKey.split("/");
  const cidr = cidrStr ? Number(cidrStr) : null;
  const mask = gizmo?.subnetMask || (cidr !== null ? cidrToMask(cidr) : "—");

  let start = "—";
  let end = "—";
  if (gizmo?.startRange && gizmo?.endRange) {
    start = gizmo.startRange;
    end = gizmo.endRange;
  } else {
    const poolRange = firstKeaPoolRange(kea?.pools);
    start = poolRange.start || "—";
    end = poolRange.end || "—";
  }

  const gizmoRouter = getGizmoOptionValues(gizmo?.dhcpOptions, "Router");
  const gateway =
    (gizmoRouter && gizmoRouter[0]) ||
    getKeaOption(kea?.optionData, "routers") ||
    prefix?.custom_fields?.DEFAULT_GATEWAY ||
    "—";

  const gizmoDns = getGizmoOptionValues(gizmo?.dhcpOptions, "DNS Servers");
  const keaDnsRaw = getKeaOption(kea?.optionData, "domain-name-servers");
  const dns = gizmoDns || (keaDnsRaw ? keaDnsRaw.split(",").map((s) => s.trim()) : []);

  const gizmoDomain = getGizmoOptionValues(gizmo?.dhcpOptions, "DNS Domain Name");
  const domain = (gizmoDomain && gizmoDomain[0]) || getKeaOption(kea?.optionData, "domain-name") || "—";

  // Gizmo gives usage numbers directly; Kea only gives raw counts to compute them from.
  let leases = 0;
  let reservations = 0;
  let utilization = null;
  if (gizmoStats) {
    leases = Number(gizmoStats.inUse) || 0;
    reservations = Number(gizmoStats.reserved) || 0;
    utilization = Math.round(Number(gizmoStats.percentageUsed) || 0);
  } else if (keaStats) {
    leases = Number(keaStats.allocatedAddresses) || 0;
    utilization =
      keaStats.totalAddresses > 0
        ? Math.round((keaStats.allocatedAddresses / keaStats.totalAddresses) * 100)
        : 0;
  }

  return {
    // Scoped by server so a subnet on both Gizmo and Kea gets two distinct ids.
    id: `${cidrKey}::${server}`,
    scopeId: subnet || "—",
    // Required by /dhcp/gizmo/{id}/... endpoints — distinct from scopeId above.
    gizmoId: gizmo?.scopeID ?? null,
    mask,
    cidr,
    name: prefix?.description || gizmo?.name || kea?.userContext?.function || cidrKey || "Unnamed scope",
    start,
    end,
    gateway,
    dns,
    domain,
    leases,
    reservations,
    utilization,
    // Kea has no status field — Netbox's prefix status describes the record, not live DHCP state.
    status: server === "none" ? "not_deployed" : gizmo?.state?.toLowerCase() || "unknown",
    hasGizmo: server === "gizmo",
    hasKea: server === "kea",
    hasNetbox: Boolean(prefix),
    // Needed to call /netbox/prefixes/{id}/dhcp/generate for a Netbox-only scope.
    netboxPrefixId: prefix?.id ?? null,
    netboxStatus: prefix?.status?.value ?? null,
    expanded: false,
  };
}

// sitesummary is keyed by CIDR; a subnet deployed on both Gizmo and Kea gets its own row for each.
export async function getScopesForSite(siteCode, token) {
  const summary = await getDhcpSiteSummary(siteCode, token);
  const scopes = [];

  for (const [cidrKey, entry] of Object.entries(summary || {})) {
    const prefix = entry?.netbox_prefix ?? null;
    const gizmo = entry?.gizmo_scope ?? null;
    const gizmoStats = entry?.gizmo_stats ?? null;
    const kea = entry?.kea_scope ?? null;
    const keaStats = entry?.kea_stats ?? null;

    const hasGizmo = Boolean(gizmo || gizmoStats);
    const hasKea = Boolean(kea || keaStats);

    if (hasGizmo) scopes.push(buildScopeRow(cidrKey, prefix, "gizmo", { gizmo, gizmoStats }));
    if (hasKea) scopes.push(buildScopeRow(cidrKey, prefix, "kea", { kea, keaStats }));
    if (!hasGizmo && !hasKea) scopes.push(buildScopeRow(cidrKey, prefix, "none"));
  }

  // kea_stats has no reservation count, unlike Gizmo — fetched directly from reservationv4 per scope.
  await Promise.all(
    scopes
      .filter((s) => s.hasKea)
      .map(async (s) => {
        try {
          const data = await getReservationsForSubnet(s.scopeId, token);
          s.reservations = Array.isArray(data) ? data.length : 0;
        } catch {
          // Leave at 0 rather than failing the whole list over one subnet's count.
        }
      })
  );

  return scopes;
}
