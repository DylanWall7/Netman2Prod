// Auto-detects gear that has moved off the site it was sent to and strikes those
// lines in the freeform "notes" box on a Gear Return record, so a manager doesn't
// have to manually check + strikethrough every serial by hand. It also un-strikes a
// line if a device someone already marked back is confirmed still checked out at the
// original site — the strike shouldn't have been there.
//
// In practice managers paste this in from all kinds of Excel shapes — one token per
// line, four columns on one line, blank lines between devices, blank lines standing in
// for a missing column, none of it consistent. So before anything else runs, the notes
// are reformatted into one canonical line per device ("<hostname> [mac] <serial>
// [model]"), grouped by recognizing that every hostname starts with the record's own
// site code — not by blank lines, which turned out to also mark missing fields (e.g.
// OOB devices with no MAC) and can't be trusted as a device boundary on their own.
// Only the serial is ever looked up in Snipe-IT — the hostname and model tokens are
// never sent to byserial.
//
// Identification stays conservative: a line is only ever touched when exactly one
// remaining token resolves to a real, existing Snipe-IT asset. Anything ambiguous
// (zero or multiple matches, or no hostname to read a site code from) is left alone.

const MAC_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;
const STRIKE_TAGS = new Set(["S", "STRIKE", "DEL"]);
const MIN_TOKEN_LENGTH = 4;
const SITE_CODE_LENGTH = 8;

export function buildModelExclusionSet(models) {
  const set = new Set();
  (models || []).forEach((m) => {
    if (m?.model_number) set.add(String(m.model_number).trim().toUpperCase());
    if (m?.name) set.add(String(m.name).trim().toUpperCase());
  });
  return set;
}

export function resolveLocationByName(locations, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;
  return (locations || []).find((l) => String(l?.name || "").trim().toLowerCase() === target) || null;
}

// Safety net for content pasted before RichNotesEditor started normalizing pastes
// (or any browser that inserts a literal "\n" instead of a real <br>/<div>) — without
// this, a whole multi-device blob can collapse into a single unsplit "line", which
// pulls hostnames into the candidate pool and makes false collisions much more likely.
function normalizeNewlines(node) {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === 3 && child.nodeValue.includes("\n")) {
      const parts = child.nodeValue.split("\n");
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (part) frag.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) frag.appendChild(document.createElement("br"));
      });
      child.parentNode.replaceChild(frag, child);
    } else if (child.nodeType === 1) {
      normalizeNewlines(child);
    }
  });
}

function collectLineGroups(container) {
  const groups = [];
  let current = [];
  const flush = () => {
    if (current.length) {
      groups.push({ kind: "flat", nodes: current });
      current = [];
    }
  };
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === 1 && node.tagName === "DIV") {
      flush();
      groups.push({ kind: "div", node });
    } else if (node.nodeType === 1 && node.tagName === "BR") {
      flush();
    } else {
      current.push(node);
    }
  });
  flush();
  return groups;
}

function groupText(group) {
  if (group.kind === "div") return group.node.textContent || "";
  return group.nodes.map((n) => n.textContent || "").join("");
}

function strikeCoveredLength(node) {
  if (node.nodeType === 3) return 0;
  if (node.nodeType !== 1) return 0;
  if (STRIKE_TAGS.has(node.tagName)) return node.textContent.length;
  let covered = 0;
  Array.from(node.childNodes).forEach((child) => {
    covered += strikeCoveredLength(child);
  });
  return covered;
}

function isGroupStruck(group) {
  const text = groupText(group);
  const totalLen = text.trim().length;
  if (totalLen === 0) return false;
  const roots = group.kind === "div" ? [group.node] : group.nodes;
  const covered = roots.reduce((sum, n) => sum + strikeCoveredLength(n), 0);
  return covered / totalLen >= 0.95;
}

function strikeGroup(container, group) {
  if (group.kind === "div") {
    group.node.innerHTML = `<s>${group.node.innerHTML}</s>`;
    return;
  }
  const s = document.createElement("s");
  container.insertBefore(s, group.nodes[0]);
  group.nodes.forEach((n) => s.appendChild(n));
}

function unwrapElement(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function unstrikeGroup(group) {
  const roots = group.kind === "div" ? [group.node] : group.nodes;
  roots.forEach((root) => {
    if (root.nodeType === 1 && STRIKE_TAGS.has(root.tagName)) {
      unwrapElement(root);
    } else if (root.nodeType === 1 && root.querySelectorAll) {
      Array.from(root.querySelectorAll("s, strike, del")).forEach(unwrapElement);
    }
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Flattens every source line into individual whitespace-separated tokens, each tagged
// with whether its source line was struck. Device boundaries can't be trusted at the
// line level — some pastes land as one token per line, others as everything on a
// single line with no breaks at all, so the only reliable signal in either case is the
// token content itself: a token that starts with the record's own site code is a
// hostname and marks the start of a new device.
function tokenizeGroups(groups) {
  const stream = [];
  groups.forEach((group) => {
    const struck = isGroupStruck(group);
    groupText(group)
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((token) => stream.push({ token, struck }));
  });
  return stream;
}

// The record's own "Site" field isn't reliable — it's often blank — so the site code
// is read straight out of the device names instead: every hostname in one record
// shares the same first-8-character prefix (that's the whole naming convention), so
// whichever 8-char prefix repeats across multiple non-MAC, non-numeric tokens is it.
// Requiring at least 2 occurrences keeps a lone serial/model that happens to share a
// prefix with nothing else from being mistaken for a site code.
function inferSiteCode(tokens) {
  const counts = new Map();
  tokens.forEach((token) => {
    if (MAC_RE.test(token)) return;
    if (token.length < SITE_CODE_LENGTH) return;
    if (/^\d+$/.test(token)) return;
    const prefix = token.slice(0, SITE_CODE_LENGTH).toUpperCase();
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  });
  let bestPrefix = null;
  let bestCount = 1;
  counts.forEach((count, prefix) => {
    if (count > bestCount) {
      bestCount = count;
      bestPrefix = prefix;
    }
  });
  return bestPrefix;
}

// Falls back to "one source line = one block" (a no-op) when no site code can be
// inferred at all, so unrecognizable content passes through unchanged rather than
// guessing.
function groupIntoDeviceBlocks(groups) {
  const stream = tokenizeGroups(groups);
  const siteCode = inferSiteCode(stream.map((entry) => entry.token));
  const isHostnameToken = (entry) => siteCode && entry.token.toUpperCase().startsWith(siteCode);

  if (siteCode) {
    const blocks = [];
    let current = null;
    stream.forEach((entry) => {
      if (isHostnameToken(entry)) {
        if (current) blocks.push(current);
        current = [entry];
      } else if (current) {
        current.push(entry);
      }
      // tokens before the first recognized hostname have no device context — dropped
    });
    if (current) blocks.push(current);
    return blocks;
  }

  return groups
    .filter((g) => groupText(g).trim())
    .map((g) => {
      const struck = isGroupStruck(g);
      return groupText(g)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((token) => ({ token, struck }));
    });
}

function buildReformattedHtml(blocks) {
  return blocks
    .map((block) => {
      const text = block.map((e) => e.token).join(" ");
      const struck = block.some((e) => e.struck);
      const safe = escapeHtml(text);
      return `<div>${struck ? `<s>${safe}</s>` : safe}</div>`;
    })
    .join("");
}

function candidateTokens(restTokens, modelExclusionSet) {
  return restTokens
    .filter((t) => !MAC_RE.test(t))
    .filter((t) => t.length >= MIN_TOKEN_LENGTH)
    .filter((t) => !modelExclusionSet.has(t.toUpperCase()));
}

// null = can't determine either way — leaves the line untouched rather than guessing.
// Missing location data must NOT default to "moved off": that was the actual bug —
// devices checked out to a person (not a location record) can come back from
// byserial with location=null even while genuinely still checked out at the site,
// and defaulting unknown to "moved off" was quietly confirming an already-wrong
// strike as correct instead of leaving it alone.
function isStillAtOriginalSite(asset, { hostname, siteLocation }) {
  const locationName = String(asset?.location?.name || "").trim().toUpperCase();
  const assignedToName = String(asset?.assigned_to?.name || "").trim().toUpperCase();
  const assignedToIsLocation = asset?.assigned_to?.type === "location";

  if (hostname) {
    const expectedCode = hostname.trim().slice(0, SITE_CODE_LENGTH).toUpperCase();
    if (!expectedCode) return null;
    if (locationName) return locationName.slice(0, SITE_CODE_LENGTH) === expectedCode;
    if (assignedToIsLocation && assignedToName) return assignedToName.slice(0, SITE_CODE_LENGTH) === expectedCode;
    return null;
  }
  if (siteLocation) {
    return (asset?.location?.id ?? null) === siteLocation.id;
  }
  return null;
}

// lookupBySerial(serial) => Promise<asset|null>
export async function checkAndStrikeReturnedGear(notesHtml, { siteName, locations, modelExclusionSet, lookupBySerial }) {
  const result = {
    html: notesHtml || "",
    totalLines: 0,
    checkedLines: 0,
    struckLines: 0,
    unstruckLines: 0,
    ambiguousLines: 0,
    notFoundLines: 0,
    unresolvedLines: 0,
    debug: [],
  };

  const siteLocation = resolveLocationByName(locations, siteName);

  const rawContainer = document.createElement("div");
  rawContainer.innerHTML = notesHtml || "";
  normalizeNewlines(rawContainer);
  const rawGroups = collectLineGroups(rawContainer);
  const blocks = groupIntoDeviceBlocks(rawGroups);
  const reformattedHtml = buildReformattedHtml(blocks);

  const container = document.createElement("div");
  container.innerHTML = reformattedHtml;
  const groups = collectLineGroups(container);

  // Work out every line's candidates first, then fire every unique lookup at once
  // instead of awaiting line-by-line — a 20-device list was making 20+ sequential
  // round trips before; now it's a single parallel batch.
  const lineInfos = groups.map((group) => {
    const text = groupText(group);
    if (!text.trim()) return null;
    const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    const hostname = tokens.length > 1 ? tokens[0] : null;
    const rest = hostname ? tokens.slice(1) : tokens;
    return { group, hostname, candidates: candidateTokens(rest, modelExclusionSet) };
  });

  const uniqueTokens = new Set();
  lineInfos.forEach((info) => info?.candidates.forEach((t) => uniqueTokens.add(t)));

  const cache = new Map();
  await Promise.all(
    Array.from(uniqueTokens).map(async (token) => {
      cache.set(token, await Promise.resolve(lookupBySerial(token)).catch(() => null));
    }),
  );

  for (const info of lineInfos) {
    if (!info) continue;
    result.totalLines += 1;
    const lineText = groupText(info.group);
    if (info.candidates.length === 0) {
      result.debug.push({ line: lineText, hostname: info.hostname, candidates: info.candidates, outcome: "no-candidates" });
      continue;
    }
    result.checkedLines += 1;

    const resolved = info.candidates.map((token) => ({ token, asset: cache.get(token) })).filter((l) => l.asset);

    if (resolved.length !== 1) {
      result.debug.push({
        line: lineText,
        hostname: info.hostname,
        candidates: info.candidates,
        resolved: resolved.map((r) => r.token),
        outcome: resolved.length === 0 ? "not-found" : "ambiguous",
      });
      if (resolved.length === 0) result.notFoundLines += 1;
      else result.ambiguousLines += 1;
      continue;
    }

    const asset = resolved[0].asset;
    const stillAtOriginalSite = isStillAtOriginalSite(asset, { hostname: info.hostname, siteLocation });
    const currentlyStruck = isGroupStruck(info.group);
    const debugEntry = {
      line: lineText,
      hostname: info.hostname,
      serial: resolved[0].token,
      assetLocation: asset?.location?.name ?? null,
      assignedTo: asset?.assigned_to?.name ?? null,
      assignedToType: asset?.assigned_to?.type ?? null,
      stillAtOriginalSite,
      currentlyStruck,
    };

    if (stillAtOriginalSite === null) {
      result.unresolvedLines += 1;
      result.debug.push({ ...debugEntry, outcome: "unresolved" });
      continue;
    }

    if (stillAtOriginalSite && currentlyStruck) {
      unstrikeGroup(info.group);
      result.unstruckLines += 1;
      result.debug.push({ ...debugEntry, outcome: "unstruck" });
    } else if (!stillAtOriginalSite && !currentlyStruck) {
      strikeGroup(container, info.group);
      result.struckLines += 1;
      result.debug.push({ ...debugEntry, outcome: "struck" });
    } else {
      result.debug.push({ ...debugEntry, outcome: "no-change" });
    }
  }

  result.html = container.innerHTML;
  return result;
}
