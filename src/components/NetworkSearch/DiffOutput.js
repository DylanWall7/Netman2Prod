import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { parseOutputData } from "./junosOutputFormat";
import { buildDiff, isPlainObject } from "./outputDiff";
import { highlightMatch, findMatchIndices } from "./searchHighlight";

const ROW_LIMIT = 50;
const LINE_HEIGHT = 18;
const OVERSCAN = 8;
const VIEW_MAX_HEIGHT = 600;

function humanizeLabel(key) {
  if (key === "@") return "attributes";
  return key.replace(/-/g, " ");
}

function modelHasChanges(model) {
  if (model.kind === "table") return model.rows.some((r) => r.changeIndex != null);
  if (model.kind === "primitiveList") return model.items.some((i) => i.changeIndex != null);
  if (model.kind === "object") {
    return (
      model.scalarFields.some((f) => f.changeIndex != null) ||
      model.complexFields.some((f) => modelHasChanges(f.model))
    );
  }
  return model.changeIndex != null;
}

function cellTextMatches(v, lowerTerm) {
  return v != null && String(v).toLowerCase().includes(lowerTerm);
}

function modelMatchesSearch(model, term) {
  if (!term) return false;
  const lower = term.toLowerCase();
  if (model.kind === "table") {
    return model.rows.some((row) => model.columns.some((col) => {
      const cell = row.cells[col];
      return cellTextMatches(cell.a, lower) || cellTextMatches(cell.b, lower);
    }));
  }
  if (model.kind === "primitiveList") {
    return model.items.some((item) => cellTextMatches(item.value, lower));
  }
  if (model.kind === "object") {
    return (
      model.scalarFields.some((f) => cellTextMatches(f.a, lower) || cellTextMatches(f.b, lower)) ||
      model.complexFields.some((f) => modelMatchesSearch(f.model, term))
    );
  }
  return cellTextMatches(model.a, lower) || cellTextMatches(model.b, lower);
}

function DiffCollapsibleSection({ label, body, forceOpen, searchTerm }) {
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
        {highlightMatch(humanizeLabel(label), searchTerm)} <span className="text-gray-600 normal-case">(no changes)</span>
      </button>
      {open && <div className="mt-2 pl-3 border-l-2 border-gray-700">{body}</div>}
    </div>
  );
}

function formatCellValue(v) {
  if (v === undefined || v === null) return "—";
  if (isPlainObject(v) || Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

function DiffCell({ cell, rowStatus, searchTerm }) {
  const isComplex = isPlainObject(cell.a) || Array.isArray(cell.a) || isPlainObject(cell.b) || Array.isArray(cell.b);
  const title = isComplex ? JSON.stringify(cell.changed ? { a: cell.a, b: cell.b } : cell.b, null, 2) : undefined;

  if (rowStatus === "added") {
    return (
      <td className="px-3 py-2 whitespace-nowrap font-mono" title={title}>
        {highlightMatch(formatCellValue(cell.b), searchTerm)}
      </td>
    );
  }
  if (rowStatus === "removed") {
    return (
      <td className="px-3 py-2 whitespace-nowrap font-mono" title={title}>
        {highlightMatch(formatCellValue(cell.a), searchTerm)}
      </td>
    );
  }
  if (cell.changed) {
    return (
      <td className="px-3 py-2 whitespace-nowrap font-mono bg-amber-900/20" title={title}>
        <div className="text-[11px] text-red-400 line-through">{highlightMatch(formatCellValue(cell.a), searchTerm)}</div>
        <div className="text-green-400">{highlightMatch(formatCellValue(cell.b), searchTerm)}</div>
      </td>
    );
  }
  return (
    <td className="px-3 py-2 whitespace-nowrap font-mono" title={title}>
      {highlightMatch(formatCellValue(cell.b), searchTerm)}
    </td>
  );
}

function rowHighlightClass(row, currentChangeIndex) {
  const isCurrent = row.changeIndex != null && row.changeIndex === currentChangeIndex;
  const base =
    row.status === "added"
      ? "bg-green-900/20 text-green-200"
      : row.status === "removed"
        ? "bg-red-900/20 text-red-200"
        : "text-gray-300";
  return isCurrent ? `${base} ring-2 ring-inset ring-blue-400` : base;
}

function DiffTable({ model, currentChangeIndex, searchTerm }) {
  const [showAll, setShowAll] = useState(false);
  const { columns, rows } = model;
  const forceShowAll = showAll || Boolean(searchTerm);

  let unchangedShown = 0;
  const visibleRows = forceShowAll
    ? rows
    : rows.filter((row) => {
        if (row.status !== "unchanged") return true;
        if (unchangedShown < ROW_LIMIT) {
          unchangedShown++;
          return true;
        }
        return false;
      });
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div>
      <div className="overflow-auto max-h-[50vh] rounded-lg border border-gray-700">
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
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                id={row.changeIndex != null ? `diff-change-${row.changeIndex}` : undefined}
                className={rowHighlightClass(row, currentChangeIndex)}
              >
                {columns.map((col) => (
                  <DiffCell key={col} cell={row.cells[col]} rowStatus={row.status} searchTerm={searchTerm} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 underline"
        >
          Show {hiddenCount} more unchanged row{hiddenCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

function DiffModelRenderer({ model, label, currentChangeIndex, depth = 0, searchTerm }) {
  if (model.kind === "table") {
    return (
      <div className="space-y-1.5">
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        <DiffTable model={model} currentChangeIndex={currentChangeIndex} searchTerm={searchTerm} />
      </div>
    );
  }

  if (model.kind === "primitiveList") {
    return (
      <div className="space-y-1.5">
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {model.items.map((item, i) => {
            const isCurrent = item.changeIndex != null && item.changeIndex === currentChangeIndex;
            return (
              <span
                key={i}
                id={item.changeIndex != null ? `diff-change-${item.changeIndex}` : undefined}
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  item.status === "added"
                    ? "bg-green-900/40 text-green-300"
                    : item.status === "removed"
                      ? "bg-red-900/40 text-red-300 line-through"
                      : "bg-gray-900/60 text-gray-300"
                } ${isCurrent ? "ring-2 ring-inset ring-blue-400" : ""}`}
              >
                {highlightMatch(String(item.value), searchTerm)}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (model.kind === "object") {
    const body = (
      <div className="space-y-3">
        {model.scalarFields.length > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {model.scalarFields.map((f) => {
              const isCurrent = f.changeIndex != null && f.changeIndex === currentChangeIndex;
              return (
                <div
                  key={f.key}
                  id={f.changeIndex != null ? `diff-change-${f.changeIndex}` : undefined}
                  className={`max-w-full ${isCurrent ? "ring-2 ring-inset ring-blue-400 rounded px-1 -mx-1" : ""}`}
                >
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                    {highlightMatch(humanizeLabel(f.key), searchTerm)}
                  </div>
                  {f.status === "changed" ? (
                    <div>
                      <div className="text-xs text-red-400 line-through font-mono">
                        {highlightMatch(String(f.a), searchTerm)}
                      </div>
                      <div className="text-sm text-green-400 font-mono">{highlightMatch(String(f.b), searchTerm)}</div>
                    </div>
                  ) : f.status === "added" ? (
                    <div className="text-sm text-green-400 font-mono break-words">
                      {highlightMatch(String(f.b), searchTerm)}
                    </div>
                  ) : f.status === "removed" ? (
                    <div className="text-sm text-red-400 line-through font-mono break-words">
                      {highlightMatch(String(f.a), searchTerm)}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-200 font-mono break-words">
                      {highlightMatch(String(f.b), searchTerm)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {model.complexFields.map((f) => (
          <DiffModelRenderer
            key={f.key}
            model={f.model}
            label={f.key}
            currentChangeIndex={currentChangeIndex}
            depth={depth + 1}
            searchTerm={searchTerm}
          />
        ))}
      </div>
    );

    if (!label) return body;

    // Deep subtrees with no changes and no search match default collapsed and aren't
    // even rendered until expanded — anything containing a real change or a search hit
    // always stays fully rendered so navigation can always find and scroll to it.
    if (depth <= 1 || modelHasChanges(model) || modelMatchesSearch(model, searchTerm)) {
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
      <DiffCollapsibleSection
        label={label}
        body={body}
        forceOpen={modelMatchesSearch(model, searchTerm)}
        searchTerm={searchTerm}
      />
    );
  }

  const isCurrent = model.changeIndex != null && model.changeIndex === currentChangeIndex;
  if (model.changed) {
    return (
      <div
        id={model.changeIndex != null ? `diff-change-${model.changeIndex}` : undefined}
        className={`space-y-0.5 ${isCurrent ? "ring-2 ring-inset ring-blue-400 rounded px-1 -mx-1" : ""}`}
      >
        {label && (
          <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
            {highlightMatch(humanizeLabel(label), searchTerm)}
          </p>
        )}
        <div className="text-xs text-red-400 line-through font-mono">{highlightMatch(String(model.a), searchTerm)}</div>
        <div className="text-sm text-green-400 font-mono">{highlightMatch(String(model.b), searchTerm)}</div>
      </div>
    );
  }
  return (
    <div>
      {label && (
        <p className="text-xs text-pink-400 font-semibold uppercase tracking-wide">
          {highlightMatch(humanizeLabel(label), searchTerm)}
        </p>
      )}
      <div className="text-sm text-gray-200 font-mono break-words">{highlightMatch(String(model.b), searchTerm)}</div>
    </div>
  );
}

function TextDiffView({ lines, currentChangeIndex, searchTerm, scrollRequest }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(VIEW_MAX_HEIGHT);

  useLayoutEffect(() => {
    if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
  }, []);

  useEffect(() => {
    if (scrollRequest && containerRef.current) {
      const target = scrollRequest.lineIndex * LINE_HEIGHT - viewportHeight / 2;
      containerRef.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  const firstLineOfHunk = useMemo(() => {
    const seen = new Set();
    const map = new Map();
    lines.forEach((line, i) => {
      if (line.changeIndex != null && !seen.has(line.changeIndex)) {
        seen.add(line.changeIndex);
        map.set(i, line.changeIndex);
      }
    });
    return map;
  }, [lines]);

  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(lines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN);
  const topPad = startIndex * LINE_HEIGHT;
  const bottomPad = (lines.length - endIndex) * LINE_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ maxHeight: VIEW_MAX_HEIGHT }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: topPad }} />
      {lines.slice(startIndex, endIndex).map((line, i) => {
        const idx = startIndex + i;
        const isCurrentHunk = line.changeIndex != null && line.changeIndex === currentChangeIndex;
        const statusClass =
          line.status === "added"
            ? "bg-green-900/30 text-green-300"
            : line.status === "removed"
              ? "bg-red-900/30 text-red-300"
              : "text-gray-500";
        return (
          <div
            key={idx}
            id={firstLineOfHunk.get(idx) != null ? `diff-change-${firstLineOfHunk.get(idx)}` : undefined}
            className={`px-4 font-mono text-xs whitespace-pre ${statusClass} ${isCurrentHunk ? "ring-2 ring-inset ring-blue-400" : ""}`}
            style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
          >
            {line.status === "added" ? "+ " : line.status === "removed" ? "- " : "  "}
            {highlightMatch(line.text, searchTerm)}
          </div>
        );
      })}
      <div style={{ height: bottomPad }} />
    </div>
  );
}

export default function OutputDiff({ dataA, dataB }) {
  const parsedA = useMemo(() => parseOutputData(dataA), [dataA]);
  const parsedB = useMemo(() => parseOutputData(dataB), [dataB]);
  const isText = parsedA.kind === "text" || parsedB.kind === "text";

  const [mode, setMode] = useState("json");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCursor, setSearchCursor] = useState(0);
  const [scrollRequest, setScrollRequest] = useState(null);

  const diffResult = useMemo(() => {
    if (isText) {
      return buildDiff({ kind: "text", textA: parsedA.value, textB: parsedB.value });
    }
    if (mode === "json") {
      return buildDiff({
        kind: "text",
        textA: JSON.stringify(parsedA.raw, null, 2),
        textB: JSON.stringify(parsedB.raw, null, 2),
      });
    }
    return buildDiff({ kind: "structured", a: parsedA.value, b: parsedB.value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedA, parsedB, mode, isText]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [diffResult]);

  useEffect(() => {
    setSearchCursor(0);
  }, [searchTerm, diffResult]);

  const searchMatchLineIndices = useMemo(() => {
    if (diffResult.kind !== "text" || !searchTerm) return [];
    return findMatchIndices(diffResult.lines, searchTerm, (l) => l.text);
  }, [diffResult, searchTerm]);

  const goToChange = (index) => {
    if (diffResult.changeCount === 0) return;
    const wrapped = ((index % diffResult.changeCount) + diffResult.changeCount) % diffResult.changeCount;
    setCurrentIndex(wrapped);
    if (diffResult.kind === "text") {
      const lineIdx = diffResult.lines.findIndex((l) => l.changeIndex === wrapped);
      if (lineIdx !== -1) setScrollRequest({ token: Date.now(), lineIndex: lineIdx });
    } else {
      document.getElementById(`diff-change-${wrapped}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const goToSearchMatch = (index) => {
    if (diffResult.kind === "text") {
      if (searchMatchLineIndices.length === 0) return;
      const wrapped =
        ((index % searchMatchLineIndices.length) + searchMatchLineIndices.length) % searchMatchLineIndices.length;
      setSearchCursor(wrapped);
      setScrollRequest({ token: Date.now(), lineIndex: searchMatchLineIndices[wrapped] });
    } else {
      const marks = Array.from(document.querySelectorAll('[data-search-hit="true"]'));
      if (marks.length === 0) return;
      const wrapped = ((index % marks.length) + marks.length) % marks.length;
      setSearchCursor(wrapped);
      marks[wrapped]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const searchMatchCount = diffResult.kind === "text" ? searchMatchLineIndices.length : null;

  return (
    <div>
      <div className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700 flex items-center justify-between gap-3 px-4 pt-3 pb-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {diffResult.changeCount > 0 ? (
            <>
              <span>
                {diffResult.changeCount} change{diffResult.changeCount !== 1 ? "s" : ""}
              </span>
              <span className="text-gray-600">·</span>
              <span>
                {currentIndex + 1} / {diffResult.changeCount}
              </span>
              <button
                onClick={() => goToChange(currentIndex - 1)}
                className="px-2 py-0.5 rounded bg-gray-900/60 hover:bg-gray-900 text-gray-300"
              >
                ‹ Prev
              </button>
              <button
                onClick={() => goToChange(currentIndex + 1)}
                className="px-2 py-0.5 rounded bg-gray-900/60 hover:bg-gray-900 text-gray-300"
              >
                Next ›
              </button>
            </>
          ) : (
            <span>No differences</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search…"
            className="w-40 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500"
          />
          {searchTerm && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-300">
              {searchMatchCount != null ? (
                searchMatchCount > 0 ? (
                  <>
                    {searchCursor + 1} / {searchMatchCount}
                    <button
                      onClick={() => goToSearchMatch(searchCursor - 1)}
                      className="px-1 hover:text-yellow-100"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => goToSearchMatch(searchCursor + 1)}
                      className="px-1 hover:text-yellow-100"
                    >
                      ›
                    </button>
                  </>
                ) : (
                  "no matches"
                )
              ) : (
                <>
                  <button onClick={() => goToSearchMatch(searchCursor - 1)} className="px-1 hover:text-yellow-100">
                    ‹
                  </button>
                  <button onClick={() => goToSearchMatch(searchCursor + 1)} className="px-1 hover:text-yellow-100">
                    ›
                  </button>
                </>
              )}
            </span>
          )}
          {isPending && (
            <span className="flex items-center gap-1.5 text-[10px] text-blue-400">
              <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              Loading…
            </span>
          )}
          {!isText && (
            <div className="flex gap-1">
              {["json", "formatted"].map((m) => (
                <button
                  key={m}
                  onClick={() => startTransition(() => setMode(m))}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    mode === m ? "bg-pink-600 text-black" : "bg-gray-900/60 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m === "json" ? "Raw JSON" : "Formatted"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={isPending ? "opacity-60" : ""}>
        {diffResult.kind === "text" ? (
          <TextDiffView
            lines={diffResult.lines}
            currentChangeIndex={currentIndex}
            searchTerm={searchTerm}
            scrollRequest={scrollRequest}
          />
        ) : (
          <div className="p-4">
            <DiffModelRenderer model={diffResult.model} currentChangeIndex={currentIndex} searchTerm={searchTerm} />
          </div>
        )}
      </div>
    </div>
  );
}
