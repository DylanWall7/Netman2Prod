import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseOutputData } from "./junosOutputFormat";
import { matchesSearch, highlightMatch, findMatchIndices, MatchNavBadge } from "./searchHighlight";

const LONG_VALUE_THRESHOLD = 120;
const SHORT_FIELD_THRESHOLD = 40;
const ROW_HEIGHT = 33;
const LINE_HEIGHT = 18;
const OVERSCAN = 8;
const TABLE_MAX_HEIGHT = 600;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

function isPrimitiveArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => !isPlainObject(v) && !Array.isArray(v));
}

function humanizeLabel(key) {
  if (key === "@") return "attributes";
  return key.replace(/-/g, " ");
}

function ScalarValue({ value, searchTerm }) {
  const [expanded, setExpanded] = useState(false);
  const text = String(value);
  const isLong = text.length > LONG_VALUE_THRESHOLD;
  const matchBeyondVisible = isLong && searchTerm && text.toLowerCase().includes(searchTerm.toLowerCase());

  useEffect(() => {
    if (matchBeyondVisible) setExpanded(true);
  }, [matchBeyondVisible]);

  const shown = isLong && !expanded ? `${text.slice(0, LONG_VALUE_THRESHOLD)}…` : text;
  return (
    <div className="text-sm text-gray-200 font-mono break-words">
      {highlightMatch(shown, searchTerm)}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-[10px] text-blue-400 hover:text-blue-300 underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function RawJsonView({ text, searchTerm }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(TABLE_MAX_HEIGHT);
  const [matchCursor, setMatchCursor] = useState(0);

  useLayoutEffect(() => {
    if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
  }, []);

  const matchLineIndices = useMemo(
    () => findMatchIndices(lines, searchTerm, (l) => l),
    [lines, searchTerm],
  );

  useEffect(() => {
    setMatchCursor(0);
  }, [searchTerm]);

  const goToMatch = (idx) => {
    if (matchLineIndices.length === 0) return;
    const wrapped = ((idx % matchLineIndices.length) + matchLineIndices.length) % matchLineIndices.length;
    setMatchCursor(wrapped);
    const target = matchLineIndices[wrapped] * LINE_HEIGHT - viewportHeight / 2;
    containerRef.current?.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(lines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN);
  const topPad = startIndex * LINE_HEIGHT;
  const bottomPad = (lines.length - endIndex) * LINE_HEIGHT;

  return (
    <div className="relative mx-4 mb-4">
      <MatchNavBadge
        current={matchCursor}
        total={matchLineIndices.length}
        onPrev={() => goToMatch(matchCursor - 1)}
        onNext={() => goToMatch(matchCursor + 1)}
      />
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-gray-700"
        style={{ maxHeight: TABLE_MAX_HEIGHT }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: topPad }} />
        {lines.slice(startIndex, endIndex).map((line, i) => (
          <div
            key={startIndex + i}
            className="px-4 text-xs text-gray-300 font-mono whitespace-pre"
            style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
          >
            {highlightMatch(line, searchTerm)}
          </div>
        ))}
        <div style={{ height: bottomPad }} />
      </div>
    </div>
  );
}

function CollapsibleSection({ label, body, forceOpen, searchTerm }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-pink-400 font-semibold uppercase tracking-wide"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {highlightMatch(humanizeLabel(label), searchTerm)}
      </button>
      {open && <div className="mt-2 pl-3 border-l-2 border-gray-700">{body}</div>}
    </div>
  );
}

function summarizeComplex(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) return value.join(", ");
    return `${value.length} item${value.length !== 1 ? "s" : ""}`;
  }
  if (isPlainObject(value)) {
    const scalarPairs = Object.entries(value).filter(([, v]) => !isPlainObject(v) && !Array.isArray(v));
    if (scalarPairs.length > 0) return scalarPairs.map(([k, v]) => `${k}: ${v}`).join(", ");
    return "{…}";
  }
  return String(value);
}

function TableRow({ row, columns, searchTerm }) {
  return (
    <tr className="text-gray-300" style={{ height: ROW_HEIGHT }}>
      {columns.map((col) => {
        const cell = row[col];
        const isComplex = isPlainObject(cell) || Array.isArray(cell);
        const displayText = isComplex ? summarizeComplex(cell) : (cell ?? "");
        return (
          <td
            key={col}
            className="px-3 py-2 whitespace-nowrap font-mono"
            title={isComplex ? JSON.stringify(cell, null, 2) : undefined}
          >
            {highlightMatch(displayText, searchTerm)}
          </td>
        );
      })}
    </tr>
  );
}

function ObjectTable({ rows, searchTerm }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(TABLE_MAX_HEIGHT);
  const [matchCursor, setMatchCursor] = useState(0);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  useLayoutEffect(() => {
    if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
  }, []);

  const matchRowIndices = useMemo(
    () =>
      findMatchIndices(rows, searchTerm, (row) =>
        Object.values(row)
          .map((v) => (isPlainObject(v) || Array.isArray(v) ? JSON.stringify(v) : String(v ?? "")))
          .join(" "),
      ),
    [rows, searchTerm],
  );

  useEffect(() => {
    setMatchCursor(0);
  }, [searchTerm]);

  const goToMatch = (idx) => {
    if (matchRowIndices.length === 0) return;
    const wrapped = ((idx % matchRowIndices.length) + matchRowIndices.length) % matchRowIndices.length;
    setMatchCursor(wrapped);
    const target = matchRowIndices[wrapped] * ROW_HEIGHT - viewportHeight / 2;
    containerRef.current?.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const topPad = startIndex * ROW_HEIGHT;
  const bottomPad = (rows.length - endIndex) * ROW_HEIGHT;

  return (
    <div className="relative">
      <MatchNavBadge
        current={matchCursor}
        total={matchRowIndices.length}
        onPrev={() => goToMatch(matchCursor - 1)}
        onNext={() => goToMatch(matchCursor + 1)}
      />
      <div
        ref={containerRef}
        className="overflow-auto max-h-[60vh] rounded-lg border border-gray-700"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <table className="min-w-full text-xs">
          <thead className="bg-gray-900 text-gray-500 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-left px-3 py-2 whitespace-nowrap">
                  {humanizeLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {topPad > 0 && (
              <tr style={{ height: topPad }}>
                <td colSpan={columns.length} />
              </tr>
            )}
            {rows.slice(startIndex, endIndex).map((row, i) => (
              <TableRow key={startIndex + i} row={row} columns={columns} searchTerm={searchTerm} />
            ))}
            {bottomPad > 0 && (
              <tr style={{ height: bottomPad }}>
                <td colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValueRenderer({ value, label, depth = 0, searchTerm }) {
  if (value === null || value === undefined) return null;

  if (isObjectArray(value)) {
    return (
      <div className="space-y-1.5">
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        <ObjectTable rows={value} searchTerm={searchTerm} />
      </div>
    );
  }

  if (isPrimitiveArray(value)) {
    return (
      <div className="space-y-1.5">
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-gray-900/60 text-xs text-gray-300 font-mono">
              {highlightMatch(String(item), searchTerm)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        {value.map((item, i) => (
          <div key={i} className="pl-3 border-l-2 border-gray-700">
            <ValueRenderer value={item} depth={depth + 1} searchTerm={searchTerm} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const scalarEntries = entries.filter(([, v]) => !isPlainObject(v) && !Array.isArray(v));
    const complexEntries = entries.filter(([, v]) => isPlainObject(v) || Array.isArray(v));
    const shortScalars = scalarEntries.filter(([, v]) => String(v).length <= SHORT_FIELD_THRESHOLD);
    const longScalars = scalarEntries.filter(([, v]) => String(v).length > SHORT_FIELD_THRESHOLD);
    const body = (
      <div className="space-y-3">
        {shortScalars.length > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {shortScalars.map(([key, v]) => (
              <div key={key} className="max-w-full">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {highlightMatch(humanizeLabel(key), searchTerm)}
                </div>
                <ScalarValue value={v} searchTerm={searchTerm} />
              </div>
            ))}
          </div>
        )}
        {longScalars.length > 0 && (
          <div className="space-y-2">
            {longScalars.map(([key, v]) => (
              <div key={key}>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {highlightMatch(humanizeLabel(key), searchTerm)}
                </div>
                <ScalarValue value={v} searchTerm={searchTerm} />
              </div>
            ))}
          </div>
        )}
        {complexEntries.map(([key, v]) => (
          <ValueRenderer key={key} value={v} label={key} depth={depth + 1} searchTerm={searchTerm} />
        ))}
      </div>
    );

    if (!label) return body;

    // Deeply nested sections (2+ levels in) default collapsed so a large tree
    // (e.g. a full device config) doesn't dump everything open at once — the
    // top-level sections stay visible so the outline is still scannable. A
    // search match anywhere inside forces the section open too.
    if (depth <= 1) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
          {body}
        </div>
      );
    }

    return (
      <CollapsibleSection
        label={label}
        body={body}
        forceOpen={matchesSearch(value, searchTerm)}
        searchTerm={searchTerm}
      />
    );
  }

  return <ScalarValue value={value} searchTerm={searchTerm} />;
}

export default function FormattedOutput({ data, mode = "json", isPending = false, searchTerm = "" }) {
  const parsed = useMemo(() => parseOutputData(data), [data]);
  const rawJsonText = useMemo(() => JSON.stringify(parsed.raw, null, 2), [parsed]);

  if (parsed.kind === "text") {
    return (
      <pre className="text-xs text-gray-300 p-4 overflow-x-auto whitespace-pre-wrap break-words font-mono">
        {highlightMatch(parsed.value, searchTerm)}
      </pre>
    );
  }

  return (
    <div className={isPending ? "opacity-60" : ""}>
      {mode === "json" ? (
        <RawJsonView text={rawJsonText} searchTerm={searchTerm} />
      ) : (
        <div className="p-4">
          <ValueRenderer value={parsed.value} searchTerm={searchTerm} />
        </div>
      )}
    </div>
  );
}
