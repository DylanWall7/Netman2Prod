import { useState } from "react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

export default function PingTool() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const pingIP = async (ip) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    try {
      const start = performance.now();
      await fetch(`https://${ip}`, {
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return { ip, alive: true, time: Math.round(performance.now() - start) };
    } catch {
      clearTimeout(timeoutId);
      return { ip, alive: false };
    }
  };

  const handlePing = async () => {
    setLoading(true);
    setResults([]);

    const ips = input
      .split(/[\n, ,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean);

    const promises = ips.map(pingIP);
    const res = await Promise.all(promises);

    setResults(res);
    setLoading(false);
  };

  return (
    <>
      <div className="  text-white flex flex-col items-center p-6">
        <h1 className="text-3xl font-bold mb-6">IP Ping Tool</h1>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter IPs (comma, space, or newline separated)"
          className="w-full max-w-lg h-40 p-4 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <button
          onClick={handlePing}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Pinging..." : "Go"}
        </button>
        <div className="w-full max-w-lg mt-8">
          {results.map((r) => (
            <div
              key={r.ip}
              className="flex items-center justify-between bg-gray-800 p-3 rounded-lg mb-2"
            >
              <span className="font-mono">{r.ip}</span>
              {r.alive ? (
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  <span className="text-sm text-gray-400">{r.time} ms</span>
                </div>
              ) : (
                <XCircleIcon className="w-6 h-6 text-red-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
