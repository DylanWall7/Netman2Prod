function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

function isPrimitiveArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => !isPlainObject(v) && !Array.isArray(v));
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

// Finds a column whose values are unique across both row sets, so rows can be matched
// by identity (e.g. an interface name or port id) instead of by position.
function findRowKey(rowsA, rowsB) {
  const columns = new Set();
  [...rowsA, ...rowsB].forEach((row) => Object.keys(row).forEach((k) => columns.add(k)));
  for (const col of columns) {
    const valuesA = rowsA.map((r) => r[col]).filter((v) => typeof v === "string" || typeof v === "number");
    const valuesB = rowsB.map((r) => r[col]).filter((v) => typeof v === "string" || typeof v === "number");
    if (valuesA.length !== rowsA.length || valuesB.length !== rowsB.length) continue;
    if (new Set(valuesA).size === rowsA.length && new Set(valuesB).size === rowsB.length) return col;
  }
  return null;
}

function buildRowDiff(a, b, columns) {
  if (a && !b) return { status: "removed", cells: Object.fromEntries(columns.map((c) => [c, { a: a[c], b: undefined, changed: true }])) };
  if (!a && b) return { status: "added", cells: Object.fromEntries(columns.map((c) => [c, { a: undefined, b: b[c], changed: true }])) };
  const cells = {};
  let changed = false;
  for (const col of columns) {
    const same = valuesEqual(a[col], b[col]);
    cells[col] = { a: a[col], b: b[col], changed: !same };
    if (!same) changed = true;
  }
  return { status: changed ? "changed" : "unchanged", cells };
}

export function diffTables(rowsA, rowsB) {
  const columns = [...new Set([...rowsA, ...rowsB].flatMap((r) => Object.keys(r)))];
  const key = findRowKey(rowsA, rowsB);

  if (!key) {
    const max = Math.max(rowsA.length, rowsB.length);
    const rows = [];
    for (let i = 0; i < max; i++) rows.push(buildRowDiff(rowsA[i], rowsB[i], columns));
    return { columns, rows };
  }

  const mapA = new Map(rowsA.map((r) => [r[key], r]));
  const mapB = new Map(rowsB.map((r) => [r[key], r]));
  const allKeys = [...new Set([...mapA.keys(), ...mapB.keys()])];
  return { columns, rows: allKeys.map((k) => buildRowDiff(mapA.get(k), mapB.get(k), columns)) };
}

export function diffPrimitiveArrays(arrA, arrB) {
  const setA = new Set(arrA);
  const setB = new Set(arrB);
  const items = [];
  for (const v of arrA) if (!setB.has(v)) items.push({ value: v, status: "removed" });
  for (const v of arrB) if (!setA.has(v)) items.push({ value: v, status: "added" });
  for (const v of arrA) if (setB.has(v)) items.push({ value: v, status: "unchanged" });
  return items;
}

export function diffObjectFields(objA, objB) {
  const a = objA || {};
  const b = objB || {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.map((key) => {
    const aPresent = key in a;
    const bPresent = key in b;
    if (!aPresent) return { key, status: "added", a: undefined, b: b[key] };
    if (!bPresent) return { key, status: "removed", a: a[key], b: undefined };
    return { key, status: valuesEqual(a[key], b[key]) ? "unchanged" : "changed", a: a[key], b: b[key] };
  });
}

// Cap on edit distance the Myers algorithm will chase before giving up. Trace memory is
// O(d * (n+m)), not O(n*m) — for two similar texts (the expected case: two snapshots of
// the same device) d stays tiny regardless of how long the texts are. This only guards
// against genuinely unrelated huge inputs where d could approach n+m.
const MAX_EDIT_DISTANCE = 3000;

// Myers' O(ND) diff algorithm — same approach `git diff` uses. Unlike a classic DP-table
// LCS (O(n*m) time AND space), this scales with the number of actual differences, so two
// mostly-identical multi-thousand-line texts diff in a fraction of a second and a fraction
// of the memory instead of allocating an n*m table that can run into gigabytes.
function myersTrace(linesA, linesB, maxD) {
  const n = linesA.length;
  const m = linesB.length;
  const max = n + m || 1;
  const size = 2 * max + 1;
  const v = new Array(size).fill(0);
  const trace = [];
  const limit = Math.min(max, maxD);

  for (let d = 0; d <= limit; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < n && y < m && linesA[x] === linesB[y]) {
        x++;
        y++;
      }
      v[k + max] = x;
      if (x >= n && y >= m) {
        return { trace, max };
      }
    }
  }
  return null;
}

function backtrackMyers(linesA, linesB, trace, max) {
  let x = linesA.length;
  let y = linesB.length;
  const ops = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max]) ? k + 1 : k - 1;
    const prevX = v[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ status: "unchanged", text: linesA[x - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      ops.push(x === prevX ? { status: "added", text: linesB[y - 1] } : { status: "removed", text: linesA[x - 1] });
    }
    x = prevX;
    y = prevY;
  }

  return ops.reverse();
}

export function diffLines(textA, textB) {
  const linesA = (textA || "").split("\n");
  const linesB = (textB || "").split("\n");

  const found = myersTrace(linesA, linesB, MAX_EDIT_DISTANCE);
  if (found) return backtrackMyers(linesA, linesB, found.trace, found.max);

  // Edit distance exceeded the cap (the two texts are wildly different, not just two
  // snapshots with a few changed lines) — bail out to a memory-safe blunt diff rather
  // than risk exhausting memory chasing an exact minimal edit script.
  return [
    ...linesA.map((text) => ({ status: "removed", text })),
    ...linesB.map((text) => ({ status: "added", text })),
  ];
}

// Builds a plain-data diff tree with a sequential changeIndex baked into every
// changed node, computed BEFORE any rendering happens — so a "N changes / next /
// previous" toolbar can know the total up front instead of counting during render.
function buildDiffModel(a, b, counter) {
  if (isObjectArray(a) || isObjectArray(b)) {
    const { columns, rows } = diffTables(isObjectArray(a) ? a : [], isObjectArray(b) ? b : []);
    const indexedRows = rows.map((row) => ({
      ...row,
      changeIndex: row.status === "unchanged" ? null : counter.value++,
    }));
    return { kind: "table", columns, rows: indexedRows };
  }

  if (isPrimitiveArray(a) || isPrimitiveArray(b)) {
    const items = diffPrimitiveArrays(isPrimitiveArray(a) ? a : [], isPrimitiveArray(b) ? b : []);
    const indexedItems = items.map((item) => ({
      ...item,
      changeIndex: item.status === "unchanged" ? null : counter.value++,
    }));
    return { kind: "primitiveList", items: indexedItems };
  }

  if (isPlainObject(a) || isPlainObject(b)) {
    const fields = diffObjectFields(a, b);
    const isComplexField = (f) => isPlainObject(f.a) || Array.isArray(f.a) || isPlainObject(f.b) || Array.isArray(f.b);
    const scalarFields = fields
      .filter((f) => !isComplexField(f))
      .map((f) => ({ ...f, changeIndex: f.status === "unchanged" ? null : counter.value++ }));
    const complexFields = fields
      .filter(isComplexField)
      .map((f) => ({ key: f.key, model: buildDiffModel(f.a, f.b, counter) }));
    return { kind: "object", scalarFields, complexFields };
  }

  const changed = !valuesEqual(a, b);
  return { kind: "scalar", a, b, changed, changeIndex: changed ? counter.value++ : null };
}

// Groups consecutive added/removed lines into one "hunk" so next/previous jumps
// between blocks of change instead of one line at a time.
function buildTextDiffModel(textA, textB, counter) {
  const rawLines = diffLines(textA, textB);
  const lines = [];
  let i = 0;
  while (i < rawLines.length) {
    if (rawLines[i].status === "unchanged") {
      lines.push({ ...rawLines[i], changeIndex: null });
      i++;
      continue;
    }
    const hunkIndex = counter.value++;
    while (i < rawLines.length && rawLines[i].status !== "unchanged") {
      lines.push({ ...rawLines[i], changeIndex: hunkIndex });
      i++;
    }
  }
  return lines;
}

export function buildDiff({ kind, a, b, textA, textB }) {
  const counter = { value: 0 };
  if (kind === "text") {
    const lines = buildTextDiffModel(textA, textB, counter);
    return { kind: "text", lines, changeCount: counter.value };
  }
  const model = buildDiffModel(a, b, counter);
  return { kind: "structured", model, changeCount: counter.value };
}

export { isPlainObject, isObjectArray, isPrimitiveArray, valuesEqual };
