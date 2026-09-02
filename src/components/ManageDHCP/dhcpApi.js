const API_ROOT = `https://${process.env.REACT_APP_API_BASEURL}/api`;
const NETBOX_ROOT = `${API_ROOT}/netbox`;
const DHCP_ROOT = `${API_ROOT}/dhcp`;

// subnetv4 (same family as reservationv4) is Kea-specific — a scope's own `id` from
// getScopesForSite is a synthetic `${cidrKey}::${server}` string, not a real Kea subnet
// ID, so this deletes by network address + prefix length instead of the id-based variant.
export async function deleteSubnet(subnet, cidr, token) {
  const res = await fetch(`${DHCP_ROOT}/subnetv4/${encodeURIComponent(subnet)}/${encodeURIComponent(cidr)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to delete scope (${res.status})`);
  return res.json();
}

// Kea's real API takes an array of subnets even for a single one — confirmed against
// dhcp-api.kiewitplaza.com's own docs. This deploys one at a time, so it's wrapped here
// rather than pushing array-handling onto every caller.
export async function createSubnet(payload, token) {
  const res = await fetch(`${DHCP_ROOT}/subnetv4`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([payload]),
  });
  if (!res.ok) throw new Error(`Failed to deploy scope (${res.status})`);
  return res.json();
}

// Generates the Kea subnet params for a Netbox prefix that isn't deployed yet —
// used to pre-fill the deploy-to-Kea form before POSTing to createSubnet.
export async function generateDhcpScopeParams(netboxPrefixId, token) {
  const res = await fetch(`${NETBOX_ROOT}/prefixes/${encodeURIComponent(netboxPrefixId)}/dhcp/generate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to generate scope parameters (${res.status})`);
  return res.json();
}

// Returns every Kea + Gizmo scope for a site in one call, replacing the old
// per-prefix subnetv4 lookup loop.
export async function getDhcpSiteSummary(siteCode, token) {
  const res = await fetch(`${DHCP_ROOT}/sitesummary/${encodeURIComponent(siteCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

// reservationv4 is Kea-specific (see the note on getReservationsForSubnet's caller) —
// these create/delete calls only ever act on a Kea reservation, not a Gizmo one.
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

// Gizmo-specific — keyed by Gizmo's own scopeID (see gizmoId on a scope row),
// not the subnet address reservationv4/Kea use.
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

// Kea-specific — same REST family as reservationv4/subnetv4 (filterable by
// ip, mac, or subnet; only subnet is used here, same as reservations).
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

// Kea and Gizmo use two different option-list conventions, confirmed against
// a real sitesummary response, 2026-08-25:
// - Kea's `optionData`: [{ name: "routers", data: "10.1.2.1" }] — lowercase
//   name, single string value on `data`.
// - Gizmo's `dhcpOptions`: [{ name: "Router", value: ["10.1.2.1"] }] —
//   capitalized name, array value.
function getKeaOption(optionData, name) {
  const opt = Array.isArray(optionData) ? optionData.find((o) => o.name === name) : null;
  return opt?.data ?? null;
}

function getGizmoOptionValues(dhcpOptions, name) {
  const opt = Array.isArray(dhcpOptions) ? dhcpOptions.find((o) => o.name === name) : null;
  return opt?.value ?? null;
}

// Confirmed shape: `pools: [{ pool: "10.145.252.10-10.145.253.244" }]`, a
// "start-end" string. Only the first pool is used — a Kea scope with multiple
// pools will under-report its range until this sums across all of them.
// `pools` itself can be `null` on an otherwise-valid kea_scope.
export function firstKeaPoolRange(pools) {
  const first = Array.isArray(pools) ? pools[0] : null;
  const [start, end] = String(first?.pool || "").split("-").map((s) => s.trim());
  return { start: start || null, end: end || null };
}

// Builds one scope row for exactly one server's view of a subnet. `server` is
// "gizmo", "kea", or "none" (not deployed anywhere) — only the fields for
// that server are populated on the input, so the same extraction logic
// naturally produces the right row regardless of which one it is.
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

  // Real usage numbers — Gizmo gives inUse/reserved/percentageUsed directly;
  // Kea gives allocatedAddresses/totalAddresses to compute the same from.
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
    // Scoped by server so a subnet deployed on both Gizmo and Kea gets two
    // distinct, stable ids rather than colliding on the shared cidrKey.
    id: `${cidrKey}::${server}`,
    scopeId: subnet || "—",
    // Gizmo's own internal scope id — distinct from scopeId (the subnet
    // address above) and required by the /dhcp/gizmo/{id}/... endpoints.
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
    // A scope deployed nowhere isn't meaningfully "active" or "unknown" the
    // way a deployed-but-unread status would be — it gets its own state.
    // Gizmo's own state (confirmed to include "Inactive", not just "Active")
    // is the only real operational signal we have; Kea has no status field
    // at all. Netbox's prefix status ("active" vs "container") describes the
    // prefix RECORD, not whether a scope is actively serving DHCP — a
    // container prefix's children read "active" too, which is why Kea rows
    // were showing a false "Active" before this was a fallback here. Netbox
    // presence/status is now surfaced separately via hasNetbox/netboxStatus.
    status: server === "none" ? "not_deployed" : gizmo?.state?.toLowerCase() || "unknown",
    hasGizmo: server === "gizmo",
    hasKea: server === "kea",
    hasNetbox: Boolean(prefix),
    // Needed to call /netbox/prefixes/{id}/dhcp/generate when deploying a
    // not-yet-deployed (Netbox-only) scope to Kea.
    netboxPrefixId: prefix?.id ?? null,
    netboxStatus: prefix?.status?.value ?? null,
    expanded: false,
  };
}

// The sitesummary response is one object keyed by CIDR string (e.g.
// "10.146.32.0/22"), confirmed 2026-08-25. Each entry independently may or
// may not carry netbox_prefix / gizmo_scope+gizmo_stats / kea_scope+kea_stats.
// Confirmed 2026-08-25: a subnet CAN be deployed on Gizmo and Kea
// simultaneously (e.g. mid-migration) — those are two independent,
// separately-tracked deployments of the same subnet, so each gets its own
// row here rather than being merged into one. This function no longer needs
// a separate Netbox site/prefix call — netbox_prefix, when it exists, is
// already embedded per entry.
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

  // Unlike Gizmo (whose gizmo_stats.reserved gives a real count for free),
  // kea_stats carries no reservation count at all — confirmed 2026-08-25
  // after a Kea row's list count (silently defaulted to 0) didn't match the
  // real count the modal fetched from reservationv4. The only way to get a
  // real number here is to ask reservationv4 directly, per Kea scope.
  await Promise.all(
    scopes
      .filter((s) => s.hasKea)
      .map(async (s) => {
        try {
          const data = await getReservationsForSubnet(s.scopeId, token);
          s.reservations = Array.isArray(data) ? data.length : 0;
        } catch {
          // Leave at 0 rather than failing the whole scope list over one
          // subnet's reservation count.
        }
      })
  );

  return scopes;
}
