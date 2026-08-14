// Auto-detects gear that has moved off the site it was sent to and strikes those
// lines in the freeform "notes" box on a Gear Return record, so a manager doesn't
// have to manually check + strikethrough every serial by hand. It also un-strikes a
// line if a device someone already marked back is confirmed still checked out at the
// original site — the strike shouldn't have been there.
//
// The notes box is a contentEditable blob with no structured fields, so lines are
// walked at the DOM level. Each line is expected to look like:
//   <hostname> [mac] <serial> [model]
// where <hostname>'s first 8 characters are the site code the device belongs to
// (e.g. "EASNYCHPWAP0101" -> "EASNYCHP"). Only the serial is ever looked up in
// Snipe-IT — the hostname and model tokens are never sent to byserial.
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

function candidateTokens(restTokens, modelExclusionSet) {
  return restTokens
    .filter((t) => !MAC_RE.test(t))
    .filter((t) => t.length >= MIN_TOKEN_LENGTH)
    .filter((t) => !modelExclusionSet.has(t.toUpperCase()));
}

// null = can't determine (no hostname site code and no fallback site to compare against)
function isStillAtOriginalSite(asset, { hostname, siteLocation }) {
  const locationName = String(asset?.location?.name || "").trim().toUpperCase();
  if (hostname) {
    const expectedCode = hostname.trim().slice(0, SITE_CODE_LENGTH).toUpperCase();
    if (!expectedCode) return null;
    if (!locationName) return false;
    return locationName.slice(0, SITE_CODE_LENGTH) === expectedCode;
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

  const container = document.createElement("div");
  container.innerHTML = notesHtml || "";
  normalizeNewlines(container);
  const groups = collectLineGroups(container);

  const cache = new Map();
  const resolveToken = (token) => {
    if (!cache.has(token)) {
      cache.set(token, Promise.resolve(lookupBySerial(token)).catch(() => null));
    }
    return cache.get(token);
  };

  for (const group of groups) {
    const text = groupText(group);
    if (!text.trim()) continue;
    result.totalLines += 1;

    const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    const hostname = tokens.length > 1 ? tokens[0] : null;
    const rest = hostname ? tokens.slice(1) : tokens;
    const candidates = candidateTokens(rest, modelExclusionSet);
    if (candidates.length === 0) continue;
    result.checkedLines += 1;

    const lookups = await Promise.all(
      candidates.map(async (token) => ({ token, asset: await resolveToken(token) })),
    );
    const resolved = lookups.filter((l) => l.asset);

    if (resolved.length !== 1) {
      if (resolved.length === 0) result.notFoundLines += 1;
      else result.ambiguousLines += 1;
      continue;
    }

    const stillAtOriginalSite = isStillAtOriginalSite(resolved[0].asset, { hostname, siteLocation });
    if (stillAtOriginalSite === null) {
      result.unresolvedLines += 1;
      continue;
    }

    const currentlyStruck = isGroupStruck(group);
    if (stillAtOriginalSite && currentlyStruck) {
      unstrikeGroup(group);
      result.unstruckLines += 1;
    } else if (!stillAtOriginalSite && !currentlyStruck) {
      strikeGroup(container, group);
      result.struckLines += 1;
    }
  }

  result.html = container.innerHTML;
  return result;
}
