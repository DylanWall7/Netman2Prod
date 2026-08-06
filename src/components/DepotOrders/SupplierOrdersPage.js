import { useCallback, useEffect, useRef, useState } from "react";
import BackLink from "./BackLink";
import Badge from "./Badge";
import {
  listSupplierOrders,
  updateSupplierOrder,
  deleteSupplierOrder,
  useSupplierOrdersToken,
} from "./supplierOrdersApi";
import { isCompleted, PERSISTED_FIELDS } from "./supplierOrdersCsv";
import { parseTrackingInfo } from "./supplierOrdersTracking";
import { parsePOTabsWorkbook, parseMainSheetFromWorkbook } from "./poTabsParser";
import { listSnipeitModels, listSnipeitHardwareByPO, useSnipeitToken } from "./snipeitApi";
import UnifiedUploadModal from "./UnifiedUploadModal";
import { formatDate } from "./dateHelpers";

const STATUS_BADGE_COLOR = {
  "Pending Shipment": "amber",
  "Delivered": "green",
  "Unknown / Lost": "red",
};

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function OrdersTable({ rows, emptyLabel, onRowClick, sortDir, onToggleSort }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-600 italic">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-900 text-gray-400">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Site ID</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Requestor</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Kiewit PO</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">
              <button onClick={onToggleSort} className="flex items-center gap-1 hover:text-gray-200">
                Order Date {sortDir === "asc" ? "▲" : "▼"}
              </button>
            </th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Sub-Total $</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Order Number</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Shipped</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/60">
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onRowClick(r)}
              className="bg-gray-800/60 text-gray-200 hover:bg-gray-700/60 cursor-pointer transition-colors"
            >
              <td className="px-4 py-2.5 whitespace-nowrap">{r.site_id}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.requestor}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.kiewit_po}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.order_date)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatMoney(r.sub_total)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.order_number}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {r.tracking ? <Badge color="blue">Shipped</Badge> : <span className="text-gray-600">—</span>}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {r.received ? <Badge color="green">Received</Badge> : <span className="text-gray-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-sm text-gray-100">{value || "—"}</p>
    </div>
  );
}

function DeviceTableModal({ devices, poNumber, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-6xl max-h-[92vh] min-h-0 overflow-y-auto bg-gray-800 rounded-xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-100">
            Devices for PO {poNumber} <span className="text-gray-500 font-normal">({devices.length})</span>
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Serial</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Asset Tag</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Model</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60">
              {devices.map((d) => (
                <tr key={d.id} className="bg-gray-800/60 text-gray-200">
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.serial}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.asset_tag}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.model?.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.category?.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Badge color={STATUS_BADGE_COLOR[d.status_label?.name] || "gray"}>
                      {d.status_label?.name || "Unknown"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onMarkReceived, markingReceived, onDelete, deleting }) {
  const tracking = parseTrackingInfo(order.tracking);
  const getSnipeitToken = useSnipeitToken();
  const [devices, setDevices] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState(null);
  const [showDeviceTable, setShowDeviceTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingDevices(true);
      setDevicesError(null);
      try {
        const token = await getSnipeitToken();
        const result = await listSnipeitHardwareByPO(order.kiewit_po, token);
        if (!cancelled) setDevices(result);
      } catch (err) {
        if (!cancelled) setDevicesError(err.message || "Failed to load devices");
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.kiewit_po]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-6xl max-h-[92vh] min-h-0 overflow-y-auto bg-gray-800 rounded-xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Kiewit PO {order.kiewit_po}</h3>
            <p className="text-xs text-gray-500">{order.site_id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <DetailField label="Site ID" value={order.site_id} />
          <DetailField label="Requestor" value={order.requestor} />
          <DetailField label="Quote Number" value={order.Quote_Number} />
          <DetailField label="Kiewit PO" value={order.kiewit_po} />
          <DetailField label="Order Date" value={order.order_date ? formatDate(order.order_date) : ""} />
          <DetailField label="ETA for HW" value={order.eta_for_hw ? formatDate(order.eta_for_hw) : ""} />
          <DetailField label="Sub-Total $" value={formatMoney(order.sub_total)} />
          <DetailField label="Remaining $ Amount" value={formatMoney(order.remaining_amount)} />
          <DetailField label="Order Number" value={order.order_number} />
          <DetailField label="PO to Ingram" value={order.po_to_ingram} />
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tracking</p>
          {tracking.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No tracking info</p>
          ) : (
            <div className="space-y-1.5">
              {tracking.map((t, i) => (
                <div key={i} className="text-sm">
                  {t.label && <span className="text-gray-500">{t.label}: </span>}
                  {t.url ? (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: "#60a5fa" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#93c5fd")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#60a5fa")}
                    >
                      {t.number}
                    </a>
                  ) : (
                    <span className="text-gray-300">{t.number}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Devices in Snipe-IT {devices ? `(${devices.length})` : ""}
            </p>
            {devices && devices.length > 0 && (
              <button
                onClick={() => setShowDeviceTable(true)}
                className="text-xs text-pink-400 hover:text-pink-300"
              >
                View as table ⤢
              </button>
            )}
          </div>
          {loadingDevices ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-300 rounded-full animate-spin" />
              Loading devices…
            </div>
          ) : devicesError ? (
            <p className="text-sm text-red-400">{devicesError}</p>
          ) : !devices || devices.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No devices tagged with this PO yet</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-300 truncate">
                    {d.serial} <span className="text-gray-500">— {d.model?.name}</span>
                  </span>
                  <Badge color={STATUS_BADGE_COLOR[d.status_label?.name] || "gray"}>
                    {d.status_label?.name || "Unknown"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{order.notes || "—"}</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onDelete}
            disabled={deleting || markingReceived}
            className="mr-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/60 text-red-300 hover:bg-red-800/60 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {deleting && <span className="w-3 h-3 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600">
            Close
          </button>
          {order.received ? (
            <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400">
              Received
            </span>
          ) : (
            <button
              onClick={onMarkReceived}
              disabled={markingReceived}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {markingReceived && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              {markingReceived ? "Saving…" : "Mark Received"}
            </button>
          )}
        </div>
      </div>

      {showDeviceTable && devices && (
        <DeviceTableModal devices={devices} poNumber={order.kiewit_po} onClose={() => setShowDeviceTable(false)} />
      )}
    </div>
  );
}

export default function SupplierOrdersPage() {
  const getToken = useSupplierOrdersToken();
  const getSnipeitToken = useSnipeitToken();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [markingReceived, setMarkingReceived] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [poTabResults, setPoTabResults] = useState(null);
  const [mainSheetRows, setMainSheetRows] = useState(null);
  const [snipeitModels, setSnipeitModels] = useState(null);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [loadingUnifiedUpload, setLoadingUnifiedUpload] = useState(false);
  const unifiedFileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await listSupplierOrders(token);
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

  const handleUnifiedFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setMainSheetRows(parseMainSheetFromWorkbook(buffer));
    setPoTabResults(parsePOTabsWorkbook(buffer));
    setLoadingUnifiedUpload(true);
    try {
      const token = await getSnipeitToken();
      setSnipeitModels(await listSnipeitModels(token));
      setShowUnifiedModal(true);
    } catch (err) {
      setError(err.message || "Failed to load Snipe-IT models");
    } finally {
      setLoadingUnifiedUpload(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!selectedOrder) return;
    setMarkingReceived(true);
    try {
      const token = await getToken();
      const payload = PERSISTED_FIELDS.concat("kiewit_po").reduce((acc, f) => {
        acc[f] = selectedOrder[f];
        return acc;
      }, {});
      payload.received = true;
      await updateSupplierOrder(selectedOrder.id, payload, token);
      await refresh();
      setSelectedOrder(null);
    } catch (err) {
      setError(err.message || "Failed to mark received");
    } finally {
      setMarkingReceived(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    const confirmed = window.confirm(
      `Delete Kiewit PO ${selectedOrder.kiewit_po} (${selectedOrder.site_id})? This removes it from the database entirely.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await deleteSupplierOrder(selectedOrder.id, token);
      await refresh();
      setSelectedOrder(null);
    } catch (err) {
      setError(err.message || "Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  const prepareRows = (rows) => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.site_id, r.requestor, r.kiewit_po, r.order_number, r.Quote_Number].some((v) =>
            String(v || "").toLowerCase().includes(q),
          ),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const da = a.order_date || "";
      const db = b.order_date || "";
      return sortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
  };

  const toggleSort = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const activeRows = prepareRows(records.filter((r) => !isCompleted(r.notes)));
  const completedRows = prepareRows(records.filter((r) => isCompleted(r.notes)));

  return (
    <div className="mt-8 px-4 pb-16">
      <div className="max-w-[1800px] mx-auto">
        <BackLink />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="inline-block text-3xl font-bold leading-tight pb-3 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Supplier Orders
            </span>
            <span className="absolute bottom-0 left-0 w-full h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search site, PO, requestor…"
              className="w-64 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              ref={unifiedFileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleUnifiedFileChange}
            />
            <button
              onClick={() => unifiedFileInputRef.current?.click()}
              disabled={loadingUnifiedUpload}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60"
            >
              {loadingUnifiedUpload ? "Loading…" : "Upload Spreadsheet"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 text-center py-10">Loading…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-bold text-pink-400 mb-3">Active Orders ({activeRows.length})</h2>
                <OrdersTable
                  rows={activeRows}
                  emptyLabel={search ? "No matching active orders" : "No active orders"}
                  onRowClick={setSelectedOrder}
                  sortDir={sortDir}
                  onToggleSort={toggleSort}
                />
              </section>

              {completedRows.length > 0 && (
                <section>
                  <button onClick={() => setShowCompleted((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
                    {showCompleted ? "Hide" : "Show"} completed ({completedRows.length})
                  </button>
                  {showCompleted && (
                    <div className="mt-3">
                      <OrdersTable
                        rows={completedRows}
                        emptyLabel={search ? "No matching completed orders" : "No completed orders"}
                        onRowClick={setSelectedOrder}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMarkReceived={handleMarkReceived}
          markingReceived={markingReceived}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}

      {showUnifiedModal && mainSheetRows && poTabResults && snipeitModels && (
        <UnifiedUploadModal
          csvRows={mainSheetRows}
          poTabResults={poTabResults}
          models={snipeitModels}
          records={records}
          onClose={() => setShowUnifiedModal(false)}
          onApplied={refresh}
        />
      )}
    </div>
  );
}
