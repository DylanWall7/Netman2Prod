import { useEffect, useMemo, useState, useTransition } from "react";
import { getDeviceOutputs, useNetworkSearchToken } from "./deviceOutputsApi";
import FormattedOutput from "./FormattedOutput";
import CompareModal from "./CompareModal";

function getOutputDate(output) {
  const raw = output.created_at || output.createdAt || output.timestamp || output.date;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatTimestamp(date) {
  return date ? date.toLocaleString() : "Unknown date";
}

const LOADER_COMMANDS = ["show version", "show interfaces", "show lldp neighbors", "show configuration"];

function TerminalLoader() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % LOADER_COMMANDS.length), 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-80 rounded-lg border border-gray-700 bg-gray-950 shadow-xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="ml-2 text-[10px] text-gray-500 font-mono">fetching outputs…</span>
      </div>
      <div className="p-4 font-mono text-xs text-green-400 min-h-[2rem]">
        <span className="text-gray-500">$</span> {LOADER_COMMANDS[index]}
        <span className="inline-block w-2 h-3.5 bg-green-400 ml-1 animate-pulse align-middle" />
      </div>
    </div>
  );
}

export default function DeviceOutputsModal({ netboxId, onClose }) {
  const getToken = useNetworkSearchToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [activeType, setActiveType] = useState(null);
  const [latestOnly, setLatestOnly] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [mode, setMode] = useState("json");
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const data = await getDeviceOutputs(netboxId, token, { latest: latestOnly });
        if (cancelled) return;
        setOutputs(data);
        setActiveType((prev) => {
          const types = [...new Set(data.map((o) => o.type).filter(Boolean))].sort();
          return prev && types.includes(prev) ? prev : types[0] || null;
        });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load outputs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netboxId, latestOnly]);

  const types = useMemo(() => [...new Set(outputs.map((o) => o.type).filter(Boolean))].sort(), [outputs]);

  const outputsForActiveType = useMemo(() => {
    const filtered = outputs.filter((o) => o.type === activeType);
    return [...filtered].sort((a, b) => {
      const da = getOutputDate(a);
      const db = getOutputDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
  }, [outputs, activeType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full h-full max-w-[98vw] max-h-[95vh] min-h-0 bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-left">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h3 className="text-lg font-bold text-gray-100">
            Device Outputs <span className="text-gray-500 font-normal">— Netbox ID {netboxId}</span>
          </h3>
          <div className="flex items-center gap-4">
            {isPending && (
              <span className="flex items-center gap-1.5 text-[10px] text-blue-400">
                <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Loading…
              </span>
            )}
            <div className="flex gap-1">
              {["formatted", "json"].map((m) => (
                <button
                  key={m}
                  onClick={() => startTransition(() => setMode(m))}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    mode === m ? "bg-pink-600 text-black" : "bg-gray-900/60 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m === "formatted" ? "Formatted" : "Raw JSON"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={latestOnly}
                onChange={(e) => setLatestOnly(e.target.checked)}
                className="accent-pink-600"
              />
              Latest only
            </label>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none">
              ×
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <TerminalLoader />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
              {error}
            </div>
          </div>
        ) : types.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-500 italic">No outputs found for this device.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 px-6 pt-3 border-b border-gray-700 overflow-x-auto shrink-0">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`whitespace-nowrap py-2.5 px-3 text-xs font-semibold rounded-t-lg transition-all duration-200 ${
                    activeType === type
                      ? "border-t-4 border-t-pink-500 bg-gray-900 text-pink-400 shadow-md"
                      : "border-t-4 border-t-transparent text-gray-500 hover:bg-gray-900/60 hover:text-gray-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-3 shrink-0">
              <p className="text-xs text-gray-500 whitespace-nowrap">
                {outputsForActiveType.length} output{outputsForActiveType.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search this tab's output…"
                  className="w-56 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                {!latestOnly && outputsForActiveType.length > 1 && (
                  <button
                    onClick={() => setShowCompare(true)}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-dashed border-blue-500/60 text-blue-400 hover:bg-blue-500/10"
                  >
                    Compare
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {outputsForActiveType.map((output) => (
                <div
                  key={output.id ?? `${output.type}-${output.created_at}`}
                  className="border border-gray-700 rounded-lg"
                >
                  <div className="px-4 py-2 bg-gray-900/60 text-xs text-gray-400 font-mono rounded-t-lg">
                    {formatTimestamp(getOutputDate(output))}
                  </div>
                  <FormattedOutput data={output.data} mode={mode} isPending={isPending} searchTerm={searchTerm} />
                </div>
              ))}
              {outputsForActiveType.length === 0 && (
                <p className="text-sm text-gray-600 italic">No outputs for this type.</p>
              )}
            </div>
          </>
        )}
      </div>

      {showCompare && (
        <CompareModal outputs={outputs} initialType={activeType} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
