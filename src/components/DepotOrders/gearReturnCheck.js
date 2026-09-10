// Auto-strikes gear-return notes lines for devices confirmed moved off their sent-to site, and un-strikes ones wrongly marked back, so managers don't have to check each serial by hand.
// Notes get reformatted into one line per device (grouped by the record's site-code prefix, since blank lines can't be trusted as boundaries) and only a Snipe-IT serial match — never hostname/model — is looked up, and only when exactly one match is found; anything ambiguous is left alone.

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

// Safety net for pastes with a literal "\n" instead of a real <br>/<div> — without this, a whole multi-device blob can collapse into one unsplit line, pulling hostnames into the candidate pool and risking false collisions.
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

// .textContent silently drops <br> breaks and glues the surrounding text together with no separator — a real risk since normalizeNewlines can leave <br> nested inside a single <div> — so walk manually and treat every <br> as a space.
function textWithBreaksAsSpaces(node) {
  if (node.nodeType === 3) return node.nodeValue || "";
  if (node.nodeType !== 1) return "";
  if (node.tagName === "BR") return " ";
  let text = "";
  Array.from(node.childNodes).forEach((child) => {
    text += textWithBreaksAsSpaces(child);
  });
  return text;
}

function groupText(group) {
  if (group.kind === "div") return textWithBreaksAsSpaces(group.node);
  return group.nodes.map((n) => textWithBreaksAsSpaces(n)).join("");
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

// Flattens every line into whitespace-separated tokens tagged with whether the line was struck — line breaks aren't a reliable device boundary, so a token starting with the record's site code is what actually marks a new device.
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

// Some pastes glue one device's serial straight onto the next device's hostname with no separator (e.g. "A073922060D1CSOCCAAQUWAP0103") — scan for the site-code-plus-device-type-marker shape anywhere in a token and cut there; already-clean tokens are returned untouched.
const DEVICE_TYPE_MARKERS = "WAP|SWA|RWA|OOB";
const EMBEDDED_HOSTNAME_RE = new RegExp(`[A-Z0-9]{${SITE_CODE_LENGTH}}(?:${DEVICE_TYPE_MARKERS})\\d{1,4}`, "gi");

function splitFusedTokens(stream) {
  const result = [];
  stream.forEach(({ token, struck }) => {
    EMBEDDED_HOSTNAME_RE.lastIndex = 0;
    const matchStarts = [];
    let m;
    while ((m = EMBEDDED_HOSTNAME_RE.exec(token))) matchStarts.push(m.index);

    if (matchStarts.length === 0 || (matchStarts.length === 1 && matchStarts[0] === 0)) {
      result.push({ token, struck });
      return;
    }

    let cursor = 0;
    matchStarts.forEach((idx) => {
      if (idx > cursor) result.push({ token: token.slice(cursor, idx), struck });
      cursor = idx;
    });
    result.push({ token: token.slice(cursor), struck });
  });
  return result;
}

// The record's "Site" field is often blank, so the site code is inferred from whichever 8-char prefix repeats across multiple non-MAC, non-numeric tokens — requiring 2+ occurrences keeps a lone serial/model from being mistaken for a site code.
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

// Falls back to one-line-per-block (a no-op) when no site code can be inferred, so unrecognizable content passes through unchanged rather than guessing.
function groupIntoDeviceBlocks(groups) {
  const stream = splitFusedTokens(tokenizeGroups(groups));
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

// Returns null (line left untouched) when it can't be determined either way — the actual bug this fixes was defaulting a missing location to "moved off", which silently confirmed an already-wrong strike for devices checked out to a person rather than a location record.
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

  // Batches every unique lookup in parallel instead of awaiting line-by-line — a 20-device list used to make 20+ sequential round trips.
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
    if (info.candidates.length === 0) continue;
    result.checkedLines += 1;

    const resolved = info.candidates.map((token) => ({ token, asset: cache.get(token) })).filter((l) => l.asset);

    if (resolved.length !== 1) {
      if (resolved.length === 0) result.notFoundLines += 1;
      else result.ambiguousLines += 1;
      continue;
    }

    const stillAtOriginalSite = isStillAtOriginalSite(resolved[0].asset, { hostname: info.hostname, siteLocation });
    if (stillAtOriginalSite === null) {
      result.unresolvedLines += 1;
      continue;
    }

    const currentlyStruck = isGroupStruck(info.group);
    if (stillAtOriginalSite && currentlyStruck) {
      unstrikeGroup(info.group);
      result.unstruckLines += 1;
    } else if (!stillAtOriginalSite && !currentlyStruck) {
      strikeGroup(container, info.group);
      result.struckLines += 1;
    }
  }

  result.html = container.innerHTML;
  return result;
}
