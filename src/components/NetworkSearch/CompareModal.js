import { useMemo, useState } from "react";
import OutputDiff from "./DiffOutput";

function getOutputDate(output) {
  const raw = output.created_at || output.createdAt || output.timestamp || output.date;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatTimestamp(date) {
  return date ? date.toLocaleString() : "Unknown date";
}

export default function CompareModal({ outputs, initialType, onClose }) {
  const types = useMemo(() => [...new Set(outputs.map((o) => o.type).filter(Boolean))].sort(), [outputs]);
  const [selectedType, setSelectedType] = useState(
    initialType && types.includes(initialType) ? initialType : types[0] || null,
  );
  const [selectedIds, setSelectedIds] = useState([]);

  const outputsForType = useMemo(() => {
    return outputs
      .filter((o) => o.type === selectedType)
      .slice()
      .sort((a, b) => {
        const da = getOutputDate(a);
        const db = getOutputDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });
  }, [outputs, selectedType]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setSelectedIds([]);
  };

  const selectedOutputs = selectedIds
    .map((id) => outputsForType.find((o) => o.id === id))
    .filter(Boolean)
    .sort((a, b) => (getOutputDate(a) ?? 0) - (getOutputDate(b) ?? 0));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="w-full h-full max-w-[95vw] max-h-[95vh] min-h-0 bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-left">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h3 className="text-lg font-bold text-gray-100">Compare Outputs</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-gray-700 overflow-x-auto shrink-0">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`whitespace-nowrap py-2.5 px-3 text-xs font-semibold rounded-t-lg transition-all duration-200 ${
                selectedType === type
                  ? "border-t-4 border-t-pink-500 bg-gray-900 text-pink-400 shadow-md"
                  : "border-t-4 border-t-transparent text-gray-500 hover:bg-gray-900/60 hover:text-gray-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="px-6 py-3 shrink-0">
          <p className="text-xs text-gray-500 mb-2">Select 2 dates to compare</p>
          <div className="flex flex-wrap gap-2">
            {outputsForType.map((output) => {
              const checked = selectedIds.includes(output.id);
              return (
                <label
                  key={output.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border text-gray-300 ${
                    checked ? "border-pink-500 bg-pink-500/10" : "border-gray-700 hover:bg-gray-900/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(output.id)}
                    className="accent-pink-600"
                  />
                  {formatTimestamp(getOutputDate(output))}
                </label>
              );
            })}
            {outputsForType.length < 2 && (
              <p className="text-xs text-gray-600 italic">Only one output for this type — nothing to compare.</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {selectedOutputs.length === 2 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-red-400">− {formatTimestamp(getOutputDate(selectedOutputs[0]))}</span>
                <span className="text-green-400">+ {formatTimestamp(getOutputDate(selectedOutputs[1]))}</span>
              </div>
              <div className="border border-gray-700 rounded-lg">
                <OutputDiff dataA={selectedOutputs[0].data} dataB={selectedOutputs[1].data} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 italic">Select 2 dates above to see what changed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
