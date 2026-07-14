import { useCallback, useEffect, useState } from "react";
import BackLink from "./BackLink";
import POGearManage from "./POGearManage";
import TicketManage from "./TicketManage";
import { listRecords, createRecord, updateRecord, pruneCompleted, useDepotOrdersToken } from "./depotOrdersApi";

const TABS = [
  { id: "pogear", label: "PO / Gear Tracker" },
  { id: "tickets", label: "Tickets" },
];

export default function ManagePage() {
  const getToken = useDepotOrdersToken();
  const [activeTab, setActiveTab] = useState("pogear");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await listRecords(token);
      setRecords(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (data) => {
    const token = await getToken();
    await createRecord(data, token);
    const fresh = await listRecords(token);
    setRecords(fresh);
    pruneCompleted(fresh, token).catch(() => {});
  };

  const handleUpdate = async (id, data) => {
    const token = await getToken();
    await updateRecord(id, data, token);
    const fresh = await listRecords(token);
    setRecords(fresh);
    pruneCompleted(fresh, token).catch(() => {});
  };

  return (
    <div className="mt-8 px-4 pb-16">
      <div className="max-w-5xl mx-auto">
        <BackLink />
        <div className="text-center mb-5">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Manage Depot Orders
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
          </h1>
        </div>

        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-1 text-xs font-semibold rounded-t-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? "border-t-4 border-t-pink-500 bg-gray-800 text-pink-400 shadow-md"
                  : "border-t-4 border-t-transparent bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-gray-800 rounded-b-xl rounded-tr-xl shadow-lg p-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 text-center py-10">Loading…</p>
          ) : activeTab === "pogear" ? (
            <POGearManage records={records} onCreate={handleCreate} onUpdate={handleUpdate} />
          ) : (
            <TicketManage records={records} onCreate={handleCreate} onUpdate={handleUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}
