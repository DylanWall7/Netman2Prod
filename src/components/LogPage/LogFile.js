import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Select,
  SelectItem,
} from "@nextui-org/react";

const TIME_RANGES = [
  { label: "Last 6 Hours",  param: "hours=6"  },
  { label: "Last 12 Hours", param: "hours=12" },
  { label: "Last 24 Hours", param: "hours=24" },
  { label: "Last 48 Hours", param: "hours=48" },
  { label: "Last 7 Days",   param: "days=7"   },
  { label: "Last 14 Days",  param: "days=14"  },
  { label: "Last 30 Days",  param: "days=30"  },
  { label: "Last 60 Days",  param: "days=60"  },
  { label: "Last 90 Days",  param: "days=90"  },
];

function parseMessage(msg) {
  const match = (msg ?? "").match(/^(\w+):\s+(\w+):\s+([\s\S]+)$/);
  if (!match) return { controller: "", action: "", detail: msg ?? "" };
  return { controller: match[1], action: match[2], detail: match[3].trim() };
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

const getColor = (detail) => {
  const d = detail?.toLowerCase() ?? "";
  if (d.includes("failed") || d.includes("error"))      return "text-red-400 font-semibold";
  if (d.includes("already exists"))                      return "text-yellow-400";
  if (d.includes("successfully") || d.includes("found")) return "text-green-400";
  return "text-gray-300";
};

const columns = [
  { key: "timestamp",  label: "Timestamp"  },
  { key: "user",       label: "User"        },
  { key: "controller", label: "Controller"  },
  { key: "action",     label: "Action"      },
  { key: "detail",     label: "Detail"      },
];

export default function LogsPage() {
  const { instance, accounts } = useMsal();
  const BASE = `https://${process.env.REACT_APP_API_BASEURL}/api`;

  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]       = useState(0);
  const [timeRange, setTimeRange] = useState("days=7");
  const [search, setSearch]     = useState("");

  const getToken = useCallback(async () => {
    const r = await instance.acquireTokenSilent({ ...GizmoRequest, account: accounts[0] });
    return r.accessToken;
  }, [instance, accounts]);

  const fetchLogs = useCallback(async (pageNum, rangeParam) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/logs?${rangeParam}&page=${pageNum}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = Array.isArray(data) ? data : (data.data ?? []);
      setLastPage(data.last_page ?? 1);
      setTotal(data.total ?? entries.length);
      setLogs(entries.map((entry) => {
        const { controller, action, detail } = parseMessage(entry.message);
        return {
          key:        String(entry.id),
          timestamp:  formatTimestamp(entry.created_at),
          user:       entry.username ?? "—",
          controller,
          action,
          detail,
          raw:        (entry.message ?? "").toLowerCase(),
        };
      }));
    } catch (e) {
      console.error("Failed to load logs:", e);
      setError("Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, [getToken, BASE]);

  useEffect(() => {
    if (accounts.length === 0) return;
    fetchLogs(page, timeRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, page, timeRange]);

  // when time range changes, reset to page 1
  const handleRangeChange = (val) => {
    setTimeRange(val);
    setPage(1);
    setSearch("");
  };

  const goTo = (p) => { if (p >= 1 && p <= lastPage) setPage(p); };

  const exportCSV = () => {
    const header = ["Timestamp", "User", "Controller", "Action", "Detail"];
    const rows = filteredLogs.map((l) =>
      [l.timestamp, l.user, l.controller, l.action, l.detail].map((v) =>
        `"${String(v).replace(/"/g, '""')}"`
      ).join(",")
    );
    const csv  = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `logs-${currentLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => l.raw.includes(q) || l.user.toLowerCase().includes(q));
  }, [logs, search]);

  const currentLabel = TIME_RANGES.find((r) => r.param === timeRange)?.label ?? "Last 7 Days";

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">

      {/* header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">System Logs</h1>
          <p className="text-xs text-gray-500">
            {currentLabel}{total > 0 && ` · ${total} entries`}
            {search && filteredLogs.length !== logs.length &&
              ` · ${filteredLogs.length} match${filteredLogs.length !== 1 ? "es" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* search */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-52"
            />
            {search && (
              <button onClick={() => setSearch("")}
                      className="text-xs text-gray-500 hover:text-white transition-colors">
                Clear
              </button>
            )}
          </div>

          {/* export */}
          <button
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
            className="px-3 py-1.5 rounded border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            ↓ Export CSV
          </button>

          {/* time range */}
          <Select
            size="sm"
            aria-label="Time range"
            className="dark w-40"
            variant="bordered"
            selectedKeys={[timeRange]}
            onSelectionChange={(keys) => handleRangeChange([...keys][0])}
          >
            {TIME_RANGES.map((r) => (
              <SelectItem key={r.param} value={r.param}>{r.label}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      {/* pagination */}
      {lastPage > 1 && !loading && (
        <div className="flex items-center justify-end gap-2 mb-3 text-sm">
          <button onClick={() => goTo(page - 1)} disabled={page === 1}
                  className="px-3 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <span className="text-gray-500 text-xs">Page {page} of {lastPage}</span>
          <button onClick={() => goTo(page + 1)} disabled={page === lastPage}
                  className="px-3 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <svg width="40" height="40" viewBox="0 0 24 24">
            <style>{`.sp{animation:spinner_MGfb .8s linear infinite;animation-delay:-.8s}.sp2{animation-delay:-.65s}.sp3{animation-delay:-.5s}@keyframes spinner_MGfb{93.75%,100%{opacity:.2}}`}</style>
            <circle className="sp"     cx="4"  cy="12" r="3" fill="#3b82f6" />
            <circle className="sp sp2" cx="12" cy="12" r="3" fill="#3b82f6" />
            <circle className="sp sp3" cx="20" cy="12" r="3" fill="#3b82f6" />
          </svg>
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-gray-500 text-sm">{search ? "No matching log entries." : "No log entries found."}</p>
      ) : (
        <Table aria-label="Logs table" removeWrapper isStriped
               className="rounded-xl overflow-hidden shadow-lg border border-gray-800">
          <TableHeader>
            {columns.map((col) => (
              <TableColumn key={col.key} className="bg-gray-800 text-gray-200 text-xs uppercase tracking-wide">
                {col.label}
              </TableColumn>
            ))}
          </TableHeader>
          <TableBody>
            {filteredLogs.map((item) => (
              <TableRow key={item.key}>
                <TableCell className="text-gray-400 whitespace-nowrap text-xs font-mono">{item.timestamp}</TableCell>
                <TableCell className="text-gray-300 text-xs whitespace-nowrap">{item.user}</TableCell>
                <TableCell className="text-blue-400 text-xs whitespace-nowrap">{item.controller}</TableCell>
                <TableCell className="text-purple-400 text-xs whitespace-nowrap">{item.action}</TableCell>
                <TableCell className={`text-xs ${getColor(item.detail)}`}>{item.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
