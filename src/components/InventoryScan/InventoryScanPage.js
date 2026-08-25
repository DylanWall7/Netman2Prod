import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import ScanSettings from "./ScanSettings";
import ScanInput from "./ScanInput";
import BatchQueue from "./BatchQueue";
import StatusResult from "./StatusResult";
import AssetQuickEditModal from "./AssetQuickEditModal";

const TABS = [
  { id: "depot", label: "Depot In", action: "Depot In" },
  { id: "location", label: "Update", action: "Update" },
  { id: "jobout", label: "Job Out", action: "Job Out" },
  { id: "add", label: "Add to Inventory", action: "Add to Inventory" },
  { id: "status", label: "Check Status", action: "Check Status" },
];

const TAB_STYLES = {
  depot: {
    activeTab: "border-t-4 border-t-green-500 bg-gray-800",
    panelBorder: "border-l-green-500",
    accentText: "text-green-400",
    dot: "bg-green-500",
    modeActiveBg: "bg-green-600",
    inputBorder: "border-green-500 focus:ring-green-500/30",
    badge: "bg-green-500/20 text-green-400",
  },
  location: {
    activeTab: "border-t-4 border-t-blue-500 bg-gray-800",
    panelBorder: "border-l-blue-500",
    accentText: "text-blue-400",
    dot: "bg-blue-500",
    modeActiveBg: "bg-blue-600",
    inputBorder: "border-blue-500 focus:ring-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400",
  },
  jobout: {
    activeTab: "border-t-4 border-t-amber-500 bg-gray-800",
    panelBorder: "border-l-amber-500",
    accentText: "text-amber-400",
    dot: "bg-amber-500",
    modeActiveBg: "bg-amber-600",
    inputBorder: "border-amber-500 focus:ring-amber-500/30",
    badge: "bg-amber-500/20 text-amber-400",
  },
  add: {
    activeTab: "border-t-4 border-t-purple-500 bg-gray-800",
    panelBorder: "border-l-purple-500",
    accentText: "text-purple-400",
    dot: "bg-purple-500",
    modeActiveBg: "bg-purple-600",
    inputBorder: "border-purple-500 focus:ring-purple-500/30",
    badge: "bg-purple-500/20 text-purple-400",
  },
  status: {
    activeTab: "border-t-4 border-t-cyan-500 bg-gray-800",
    panelBorder: "border-l-cyan-500",
    accentText: "text-cyan-400",
    dot: "bg-cyan-500",
    modeActiveBg: "bg-cyan-600",
    inputBorder: "border-cyan-500 focus:ring-cyan-500/30",
    badge: "bg-cyan-500/20 text-cyan-400",
  },
};

const EMPTY_SETTINGS = {
  depot: {},
  location: {},
  jobout: {},
  add: {},
  status: {},
};
const EMPTY_QUEUE = {
  depot: [],
  location: [],
  jobout: [],
  add: [],
  status: [],
};
const EMPTY_LOCKED = {
  depot: false,
  location: false,
  jobout: false,
  add: false,
  status: false,
};

function formatTime(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function InventoryScanPage() {
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };
  const baseUrl = `https://${process.env.REACT_APP_API_BASEURL}`;

  const [activeTab, setActiveTab] = useState("depot");
  const [scanMode, setScanMode] = useState("single");
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [locked, setLocked] = useState(EMPTY_LOCKED);
  const [batchQueue, setBatchQueue] = useState(EMPTY_QUEUE);
  const [recentScans, setRecentScans] = useState(() => {
    try {
      const stored = sessionStorage.getItem("inventoryRecentScans");
      if (!stored) return [];
      return JSON.parse(stored).map((s) => ({
        ...s,
        timestamp: new Date(s.timestamp),
      }));
    } catch {
      return [];
    }
  });
  const [singleResult, setSingleResult] = useState(null);
  const [statusResult, setStatusResult] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");
  const [expandedScanIndex, setExpandedScanIndex] = useState(null);
  const [assetCache, setAssetCache] = useState({});
  const [assetCacheLoading, setAssetCacheLoading] = useState(false);
  const [quickEditScan, setQuickEditScan] = useState(null);

  const getToken = async () => {
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      // Full-page redirect, not a popup — this app's redirectUri points at the SPA root, so
      // a popup just loads the whole app inside itself instead of closing. Redirect reuses
      // the already-registered URI (no Azure changes needed) and navigates the tab away, so
      // this never meaningfully returns — the user lands back freshly authenticated and
      // just retries whatever they were doing.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "inventoryRecentScans",
        JSON.stringify(recentScans),
      );
    } catch {}
  }, [recentScans]);

  const addRecentScan = (serial, tab, target, status, message, assetData = null, log = []) => {
    setAssetCache((prev) => { const next = { ...prev }; delete next[serial]; return next; });
    setRecentScans((prev) =>
      [
        {
          serial,
          tabId: tab,
          action: TABS.find((t) => t.id === tab)?.action || tab,
          target,
          status,
          message,
          assetData,
          log,
          timestamp: new Date(),
          dotClass: TAB_STYLES[tab].dot,
        },
        ...prev,
      ].slice(0, 50),
    );
  };

  const isSettingsReady = (tab = activeTab) => {
    const s = settings[tab];
    if (tab === "depot") return !!s.locationId;
    if (tab === "location") return !!s.locationId;
    if (tab === "jobout") return !!s.locationId;
    if (tab === "add") return !!s.locationId && !!s.modelId && !!s.statusId;
    if (tab === "status") return true;
    return false;
  };

  const buildBody = (tab, serial) => {
    const s = settings[tab];
    if (tab === "depot") {
      const body = { location_id: s.locationId };
      if (s.statusId) body.status_id = s.statusId;
      return body;
    }
    if (tab === "location") {
      const body = { location_id: s.locationId };
      if (s.statusId) body.status_id = s.statusId;
      if (s.notes?.trim()) body.notes = s.notes.trim();
      return body;
    }
    if (tab === "jobout") return { checkout_to_type: "location", assigned_location: s.locationId, status_id: 4 };
    if (tab === "add")
      return {
        serial,
        asset_tag: serial,
        model_id: s.modelId,
        status_id: s.statusId,
        location_id: s.locationId,
      };
    return {};
  };

  const getEndpoint = (tab, serial) => {
    if (tab === "depot")
      return `${baseUrl}/api/snipeit/hardware/${serial}/checkin`;
    if (tab === "location") return `${baseUrl}/api/snipeit/hardware/${serial}`;
    if (tab === "jobout")
      return `${baseUrl}/api/snipeit/hardware/${serial}/checkout`;
    if (tab === "add") return `${baseUrl}/api/snipeit/hardware`;
    return null;
  };

  const getMethod = (tab) => {
    if (tab === "location") return "PATCH";
    if (tab === "add") return "POST";
    return "POST";
  };

  const getTarget = (tab) => {
    const s = settings[tab];
    if (tab === "add") {
      const parts = [s.modelName, s.locationName, s.statusName].filter(Boolean);
      return parts.join(" → ");
    }
    if (s.locationName && s.statusName)
      return `${s.locationName} → ${s.statusName}`;
    return s.locationName || s.statusName || s.modelName || "";
  };

  const submitScan = async (serial, tab, token) => {
    const res = await fetch(getEndpoint(tab, serial), {
      method: getMethod(tab),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(tab, serial)),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data?.status !== 0;

    let message;
    if (ok) {
      message = data?.message || "Success";
    } else {
      const errorEntry = data?.log?.find((l) => l.status === 0);
      if (errorEntry?.msg) {
        try {
          const parsed = JSON.parse(errorEntry.msg);
          message = parsed?.messages || parsed?.message || errorEntry.msg;
        } catch {
          message = errorEntry.msg;
        }
      } else {
        message = data?.message || data?.messages || "Failed";
      }
    }

    return { ok, message, log: data?.log ?? [] };
  };

  const handleSingleScan = async (serial, tabOverride) => {
    const tab = tabOverride ?? activeTab;

    if (tab === "status") {
      setIsSubmitting(true);
      setStatusResult(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `${baseUrl}/api/snipeit/hardware/byserial/${serial}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const json = await res.json().catch(() => ({}));
        const data = json?.data || json;
        if (res.ok) {
          setStatusResult({ serial, data });
          const statusName = data?.status_label?.name || "Unknown";
          const location = data?.location?.name ? ` @ ${data.location.name}` : "";
          addRecentScan(serial, "status", `${statusName}${location}`, "success", "");
        } else {
          setStatusResult({
            serial,
            error: json?.message || "Device not found",
          });
          addRecentScan(serial, "status", "", "error", json?.message || "Device not found");
        }
      } catch {
        setStatusResult({ serial, error: "Network error — check connection" });
        addRecentScan(serial, "status", "", "error", "Network error");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const tabAction = TABS.find((t) => t.id === tab)?.action;
    setDuplicateWarning(
      recentScans.some((s) => s.serial === serial && s.action === tabAction),
    );
    setIsSubmitting(true);
    setSingleResult(null);
    setExpandedScanIndex(null);
    try {
      const token = await getToken();
      const { ok, message, log } = await submitScan(serial, tab, token);
      const target = getTarget(tab);
      let assetData = null;
      let finalMessage = message;
      if (ok) {
        setSingleResult({ status: "success", message: `${message} → ${target}` });
      } else {
        try {
          const statusRes = await fetch(`${baseUrl}/api/snipeit/hardware/byserial/${serial}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusJson = await statusRes.json().catch(() => ({}));
          const asset = statusJson?.data;
          if (statusRes.ok && asset?.id) {
            assetData = asset;
          } else {
            finalMessage = "Asset not found in SnipeIT";
          }
        } catch {}
        setSingleResult({ status: "error", message: finalMessage, assetData, log });
      }
      addRecentScan(serial, tab, target, ok ? "success" : "error", finalMessage, assetData, ok ? [] : log);
      if (ok && !locked[tab]) setLocked((prev) => ({ ...prev, [tab]: true }));
    } catch {
      setSingleResult({ status: "error", message: "Network error — check connection" });
      addRecentScan(serial, tab, "", "error", "Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchAdd = (serial) => {
    const batchTabAction = TABS.find((t) => t.id === activeTab)?.action;
    setDuplicateWarning(
      recentScans.some(
        (s) => s.serial === serial && s.action === batchTabAction,
      ) || batchQueue[activeTab].some((q) => q.serial === serial),
    );
    setBatchQueue((prev) => ({
      ...prev,
      [activeTab]: [
        ...prev[activeTab],
        { serial, status: "pending", message: "" },
      ],
    }));
  };

  const handleBatchSubmit = async () => {
    const tab = activeTab;
    const queue = batchQueue[tab];
    if (!queue.length) return;
    setIsSubmitting(true);
    let anySuccess = false;
    try {
      const token = await getToken();
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].status === "success") continue;
        setBatchQueue((prev) => ({
          ...prev,
          [tab]: prev[tab].map((q, idx) =>
            idx === i ? { ...q, status: "processing" } : q,
          ),
        }));
        try {
          if (tab === "status") {
            const res = await fetch(
              `${baseUrl}/api/snipeit/hardware/byserial/${queue[i].serial}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            const json = await res.json().catch(() => ({}));
            const data = json?.data || json;
            const statusName = data?.status_label?.name || "Unknown status";
            const location = data?.location?.name
              ? ` @ ${data.location.name}`
              : "";
            const message = res.ok
              ? `${statusName}${location}`
              : json?.message || "Not found";
            if (res.ok) anySuccess = true;
            setBatchQueue((prev) => ({
              ...prev,
              [tab]: prev[tab].map((q, idx) =>
                idx === i
                  ? { ...q, status: res.ok ? "success" : "error", message, data: res.ok ? data : null }
                  : q,
              ),
            }));
            addRecentScan(queue[i].serial, "status", res.ok ? message : "", res.ok ? "success" : "error", res.ok ? "" : message);
          } else {
            const { ok, message } = await submitScan(
              queue[i].serial,
              tab,
              token,
            );
            const target = getTarget(tab);
            if (ok) anySuccess = true;
            setBatchQueue((prev) => ({
              ...prev,
              [tab]: prev[tab].map((q, idx) =>
                idx === i
                  ? { ...q, status: ok ? "success" : "error", message }
                  : q,
              ),
            }));
            addRecentScan(
              queue[i].serial,
              tab,
              target,
              ok ? "success" : "error",
              message,
            );
          }
        } catch {
          setBatchQueue((prev) => ({
            ...prev,
            [tab]: prev[tab].map((q, idx) =>
              idx === i
                ? { ...q, status: "error", message: "Network error" }
                : q,
            ),
          }));
          if (tab !== "status")
            addRecentScan(queue[i].serial, tab, "", "error", "Network error");
        }
      }
      if (anySuccess && !locked[tab])
        setLocked((prev) => ({ ...prev, [tab]: true }));
    } catch (err) {
      console.error("Token error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchClear = () => {
    setBatchQueue((prev) => ({ ...prev, [activeTab]: [] }));
    setDuplicateWarning(false);
  };
  const handleBatchClearSucceeded = () => {
    setBatchQueue((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((i) => i.status !== "success"),
    }));
    setDuplicateWarning(false);
  };

  const handleBatchDelete = (index) =>
    setBatchQueue((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((_, i) => i !== index),
    }));

  const handleExpandScan = async (i, scan) => {
    if (expandedScanIndex === i) {
      setExpandedScanIndex(null);
      return;
    }
    setExpandedScanIndex(i);
    if (scan.status === "success" && !assetCache[scan.serial]) {
      setAssetCacheLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/snipeit/hardware/byserial/${scan.serial}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        const asset = json?.data;
        if (res.ok && asset?.id) setAssetCache((prev) => ({ ...prev, [scan.serial]: asset }));
      } catch {}
      finally { setAssetCacheLoading(false); }
    }
  };

  const handleResetSettings = () => {
    setLocked((prev) => ({ ...prev, [activeTab]: false }));
    setSingleResult(null);
    setStatusResult(null);
    setDuplicateWarning(false);
  };

  const styles = TAB_STYLES[activeTab];
  const isStatusTab = activeTab === "status";
  const isLastTab = activeTab === TABS[TABS.length - 1].id;

  return (
    <div className="mt-8 px-4 pb-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-5">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Inventory Scan
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
          </h1>
          <p className="text-sm text-pink-500">SnipeIT Asset Management</p>
        </div>

        <div className="flex gap-1">
          {TABS.map((tab) => {
            const s = TAB_STYLES[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSingleResult(null);
                  setStatusResult(null);
                  setDuplicateWarning(false);
                }}
                className={`flex-1 py-2.5 px-1 text-xs font-semibold rounded-t-lg transition-all duration-200 ${
                  isActive
                    ? `${s.activeTab} ${s.accentText} shadow-md`
                    : "border-t-4 border-t-transparent bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className={`bg-gray-800 rounded-b-xl ${isLastTab ? "" : "rounded-tr-xl"} shadow-lg border-l-4 ${styles.panelBorder} p-5`}
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mode
            </span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {["single", "batch"].map((m) => (
                <button
                  key={m}
                  onClick={() => setScanMode(m)}
                  className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    scanMode === m
                      ? `${styles.modeActiveBg} text-white`
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {scanMode === "single"
                ? isStatusTab
                  ? "Looks up each scan immediately"
                  : "Submits on each scan"
                : isStatusTab
                  ? "Queue serials then look up all"
                  : "Queue then submit all"}
            </span>
          </div>

          <ScanSettings
            tabId={activeTab}
            settings={settings[activeTab]}
            onSettingsChange={(updates) =>
              setSettings((prev) => ({
                ...prev,
                [activeTab]: { ...prev[activeTab], ...updates },
              }))
            }
            locked={locked[activeTab]}
            onReset={handleResetSettings}
            styles={styles}
          />

          <ScanInput
            mode={scanMode}
            onScan={scanMode === "batch" ? handleBatchAdd : handleSingleScan}
            disabled={!isSettingsReady() || isSubmitting}
            isSubmitting={isSubmitting}
            singleResult={isStatusTab ? null : singleResult}
            onClearResult={() => {
              setSingleResult(null);
              setStatusResult(null);
            }}
            styles={styles}
            settingsReady={isSettingsReady()}
            duplicateWarning={duplicateWarning}
          />

          {isStatusTab && scanMode === "single" && statusResult && (
            <StatusResult
              result={statusResult}
              styles={styles}
              onClear={() => setStatusResult(null)}
            />
          )}

          {scanMode === "batch" && (
            <BatchQueue
              items={batchQueue[activeTab]}
              onSubmitAll={handleBatchSubmit}
              onClear={handleBatchClear}
              onClearSucceeded={handleBatchClearSucceeded}
              onDelete={handleBatchDelete}
              isSubmitting={isSubmitting}
              styles={styles}
              settingsReady={isSettingsReady()}
              isStatusTab={isStatusTab}
            />
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent Scans
            </h3>
            {recentScans.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setRecentScans([]); setRecentSearch(""); }}
                  className="text-xs text-red-700 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={recentSearch}
                    onChange={(e) => setRecentSearch(e.target.value)}
                    placeholder="Search serials..."
                    className="pl-7 pr-3 py-1 text-xs font-mono rounded-lg border border-gray-600 bg-gray-700
                               text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-pink-500
                               focus:ring-1 focus:ring-pink-500/30 transition-colors w-44"
                  />
                </div>
              </div>
            )}
          </div>
          {recentScans.length === 0 ? (
            <div className="bg-gray-800 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-gray-500">No scans yet this session</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-800 rounded-xl shadow divide-y divide-gray-700 max-h-72 overflow-y-auto">
                {recentScans
                  .filter(
                    (s) =>
                      !recentSearch.trim() ||
                      s.serial.toLowerCase().includes(recentSearch.trim().toLowerCase()),
                  )
                  .map((scan, i) => {
                    const isError = scan.status === "error";
                    const isExpanded = expandedScanIndex === i;
                    const cachedAsset = assetCache[scan.serial];
                    const expandedAsset = isError ? scan.assetData : cachedAsset;
                    return (
                      <div key={i} className="divide-y divide-gray-700/50">
                        <div className="flex items-center gap-3 px-4 py-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scan.dotClass}`} />
                          <span className="font-mono text-sm text-pink-400 w-40 truncate">{scan.serial}</span>
                          <span className="text-xs text-gray-500 w-28 flex-shrink-0">{scan.action}</span>
                          <span className={`text-xs flex-1 truncate ${isError ? "text-red-400/80" : "text-gray-500"}`}>
                            {isError ? scan.message : scan.target}
                          </span>
                          {isError ? (
                            <button
                              onClick={() => { setQuickEditScan(scan); setExpandedScanIndex(null); }}
                              className="flex-shrink-0 text-gray-600 hover:text-pink-400 transition-colors"
                              title={scan.assetData ? "Quick Edit Asset" : "Add to Inventory"}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          ) : (
                            <span className="w-3.5 flex-shrink-0" />
                          )}
                          <span className="text-xs text-gray-600 flex-shrink-0">{formatTime(scan.timestamp)}</span>
                          <button
                            onClick={() => handleExpandScan(i, scan)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 transition-colors cursor-pointer ${
                              isError
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            }`}
                          >
                            {isError ? "Error" : "OK"}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className={`px-4 py-3 space-y-2 ${isError ? "bg-red-500/5" : "bg-green-500/5"}`}>
                            {assetCacheLoading && !isError && !cachedAsset && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                                Loading asset status…
                              </div>
                            )}
                            {expandedAsset && (
                              <div className={`flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${isError ? "text-red-300/80" : "text-green-300/80"}`}>
                                {expandedAsset.status_label?.name && (
                                  <span>Status: <span className={`font-medium ${isError ? "text-red-200" : "text-green-200"}`}>{expandedAsset.status_label.name}</span></span>
                                )}
                                {expandedAsset.location?.name && (
                                  <span>Location: <span className={`font-medium ${isError ? "text-red-200" : "text-green-200"}`}>{expandedAsset.location.name}</span></span>
                                )}
                                {expandedAsset.assigned_to?.name && (
                                  <span>Assigned to: <span className={`font-medium ${isError ? "text-red-200" : "text-green-200"}`}>{expandedAsset.assigned_to.name}</span></span>
                                )}
                              </div>
                            )}
                            {isError && scan.log?.length > 0 && (
                              <div className="space-y-1">
                                {scan.log.map((entry, j) => {
                                  let msg = entry.msg;
                                  try { const p = JSON.parse(msg); msg = p?.messages || p?.message || msg; } catch {}
                                  return (
                                    <div key={j} className="flex items-start gap-1.5 text-xs">
                                      <span className={`mt-0.5 flex-shrink-0 font-bold ${entry.status === 0 ? "text-red-400" : "text-green-400"}`}>
                                        {entry.status === 0 ? "✗" : "✓"}
                                      </span>
                                      <span className={`font-mono ${entry.status === 0 ? "text-red-300" : "text-green-300/70"}`}>{msg}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {isError && (
                              <div className="pt-1.5 border-t border-red-500/10">
                                <button
                                  onClick={() => { setQuickEditScan(scan); setExpandedScanIndex(null); }}
                                  className="flex items-center gap-1.5 text-xs font-medium text-pink-400 hover:text-white transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  {scan.assetData ? "Quick Edit Asset" : "Add to Inventory"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              {recentSearch.trim() &&
                recentScans.filter((s) =>
                  s.serial
                    .toLowerCase()
                    .includes(recentSearch.trim().toLowerCase()),
                ).length === 0 && (
                  <p className="mt-2 text-xs text-gray-600 text-center">
                    No matching serials found
                  </p>
                )}
            </>
          )}
        </div>
      </div>

      {quickEditScan && (
        <AssetQuickEditModal
          serial={quickEditScan.serial}
          assetData={quickEditScan.assetData}
          onClose={() => setQuickEditScan(null)}
          onSuccess={() => handleSingleScan(quickEditScan.serial, quickEditScan.tabId)}
        />
      )}
    </div>
  );
}
