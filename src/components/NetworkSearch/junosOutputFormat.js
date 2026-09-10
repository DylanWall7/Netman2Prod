function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Junos's XML-to-JSON conversion wraps every leaf as [{ "data": value }] and nests single items as one-element arrays — this strips that down to plain values so any output type renders generically.
function normalizeJunosXmlJson(node) {
  if (Array.isArray(node)) {
    const normalized = node.map(normalizeJunosXmlJson).filter((v) => v !== undefined);
    return normalized.length === 1 ? normalized[0] : normalized;
  }
  if (node && typeof node === "object") {
    const result = {};
    for (const key of Object.keys(node)) {
      if (key === "attributes") continue;
      const value = normalizeJunosXmlJson(node[key]);
      if (value !== undefined) result[key] = value;
    }
    // "@" holds XML attributes from the parent element (e.g. junos:commit-seconds) — fold it into the parent instead of showing it as its own unlabeled section.
    if (isPlainObject(result["@"])) {
      Object.assign(result, result["@"]);
      delete result["@"];
    }

    const keys = Object.keys(result);
    if (keys.length === 0) return undefined;
    if (keys.length === 1) return result[keys[0]];
    return result;
  }
  return node;
}

// Returns { kind: "text", value } for non-JSON output, or { kind: "structured", value: normalized, raw: untouched } when it parses as JSON.
export function parseOutputData(data) {
  if (typeof data !== "string") return { kind: "structured", value: data, raw: data };
  try {
    const parsed = JSON.parse(data);
    return { kind: "structured", value: normalizeJunosXmlJson(parsed), raw: parsed };
  } catch {
    return { kind: "text", value: data };
  }
}
