function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function matchesSearch(value, term) {
  if (!term) return false;
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((v) => matchesSearch(v, term));
  if (isPlainObject(value)) return Object.values(value).some((v) => matchesSearch(v, term));
  return String(value).toLowerCase().includes(term.toLowerCase());
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// For virtualized lists (only a slice is ever in the DOM), matches have to be found
// by scanning the underlying data directly, not by querying the DOM.
export function findMatchIndices(items, term, getText) {
  if (!term) return [];
  const lower = term.toLowerCase();
  const indices = [];
  items.forEach((item, i) => {
    if (getText(item).toLowerCase().includes(lower)) indices.push(i);
  });
  return indices;
}

export function MatchNavBadge({ current, total, onPrev, onNext }) {
  if (total === 0) return null;
  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900/90 border border-yellow-500/40 text-[10px] text-yellow-300 shadow-lg">
      <span>
        {current + 1} / {total}
      </span>
      <button onClick={onPrev} className="px-1 hover:text-yellow-100">
        ‹
      </button>
      <button onClick={onNext} className="px-1 hover:text-yellow-100">
        ›
      </button>
    </div>
  );
}

export function highlightMatch(text, term) {
  const str = String(text ?? "");
  if (!term) return str;
  const escaped = escapeRegExp(term);
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = str.split(regex);
  if (parts.length === 1) return str;
  const lowerTerm = term.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lowerTerm ? (
      <mark key={i} data-search-hit="true" className="bg-yellow-400 text-gray-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
