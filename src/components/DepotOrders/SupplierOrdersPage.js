import { useCallback, useEffect, useRef, useState } from "react";
import BackLink from "./BackLink";
import Badge from "./Badge";
import {
  listSupplierOrders,
  createSupplierOrder,
  updateSupplierOrder,
  useSupplierOrdersToken,
} from "./supplierOrdersApi";
import {
  parseSupplierOrdersCsv,
  computeSupplierOrdersDiff,
  isCompleted,
  FIELD_LABELS,
  PERSISTED_FIELDS,
} from "./supplierOrdersCsv";
import { parseTrackingInfo } from "./supplierOrdersTracking";

function OrdersTable({ rows, emptyLabel, onRowClick }) {
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
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Order Date</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Sub-Total $</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Order Number</th>
            <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Shipped</th>
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
              <td className="px-4 py-2.5 whitespace-nowrap">{r.order_date}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.sub_total}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.order_number}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {r.tracking ? <Badge color="blue">Shipped</Badge> : <span className="text-gray-600">—</span>}
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

function OrderDetailModal({ order, onClose, onMarkReceived, markingReceived }) {
  const tracking = parseTrackingInfo(order.tracking);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-gray-800 rounded-xl shadow-2xl p-6"
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

        <div className="grid grid-cols-2 gap-4 mb-5">
          <DetailField label="Site ID" value={order.site_id} />
          <DetailField label="Requestor" value={order.requestor} />
          <DetailField label="Quote Number" value={order.Quote_Number} />
          <DetailField label="Kiewit PO" value={order.kiewit_po} />
          <DetailField label="Order Date" value={order.order_date} />
          <DetailField label="ETA for HW" value={order.eta_for_hw} />
          <DetailField label="Sub-Total $" value={order.sub_total} />
          <DetailField label="Remaining $ Amount" value={order.remaining_amount} />
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

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{order.notes || "—"}</p>
        </div>

        <div className="flex justify-end gap-2">
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
    </div>
  );
}

function NewRow({ entry, checked, onToggle }) {
  const { csvRow } = entry;
  return (
    <label className="flex items-start gap-3 px-4 py-3 bg-gray-700/50 rounded-lg cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 flex-shrink-0 accent-pink-600"
      />
      <div>
        <p className="text-sm font-semibold text-gray-100">
          {csvRow.kiewit_po} — {csvRow.site_id} ({csvRow.requestor})
        </p>
        <p className="text-xs text-gray-500">
          Quote {csvRow.Quote_Number} — {csvRow.order_date}
        </p>
        {csvRow.notes && <p className="mt-1 text-xs text-gray-400">{csvRow.notes}</p>}
      </div>
    </label>
  );
}

function UpdatedRow({ entry, checked, onToggle }) {
  const { csvRow, changes } = entry;
  const willBeCompleted = isCompleted(csvRow.notes);
  return (
    <label className="flex items-start gap-3 px-4 py-3 bg-gray-700/50 rounded-lg cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 flex-shrink-0 accent-pink-600"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-100">
            {csvRow.kiewit_po} — {csvRow.site_id}
          </p>
          {willBeCompleted && <Badge color="green">Marking Completed</Badge>}
        </div>
        <div className="mt-2 space-y-1">
          {changes.map((c) => (
            <p key={c.field} className="text-xs">
              <span className="text-gray-500">{FIELD_LABELS[c.field]}:</span>{" "}
              <span className="text-red-400 line-through">{c.from || "—"}</span>{" "}
              <span className="text-gray-600">→</span>{" "}
              <span className="text-green-400">{c.to || "—"}</span>
            </p>
          ))}
        </div>
      </div>
    </label>
  );
}

const newRowKey = (entry) => `new:${entry.csvRow.kiewit_po}`;
const updatedRowKey = (entry) => `updated:${entry.csvRow.kiewit_po}`;

function allKeys(diff) {
  return [...diff.newRows.map(newRowKey), ...diff.updatedRows.map(updatedRowKey)];
}

function ReviewPanel({ diff, applying, applyErrors, onApply, onCancel }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [selected, setSelected] = useState(() => new Set(allKeys(diff)));

  useEffect(() => {
    setSelected(new Set(allKeys(diff)));
  }, [diff]);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApplyClick = () => {
    onApply(
      diff.newRows.filter((e) => selected.has(newRowKey(e))),
      diff.updatedRows.filter((e) => selected.has(updatedRowKey(e))),
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-5 mb-5 border border-pink-500/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200">Review upload</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={applying}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyClick}
            disabled={applying || selected.size === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {applying && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
            {applying ? "Applying…" : `Apply Selected (${selected.size})`}
          </button>
        </div>
      </div>

      {applyErrors.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-xs space-y-1">
          {applyErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-green-400 mb-2">
          New ({diff.newRows.length})
        </h4>
        {diff.newRows.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No new orders</p>
        ) : (
          <div className="space-y-2">
            {diff.newRows.map((entry) => (
              <NewRow
                key={entry.csvRow.kiewit_po}
                entry={entry}
                checked={selected.has(newRowKey(entry))}
                onToggle={() => toggle(newRowKey(entry))}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
          Updated ({diff.updatedRows.length})
          {diff.updatedRows.some((e) => isCompleted(e.csvRow.notes)) && (
            <span className="ml-2 text-green-400 normal-case tracking-normal">
              — {diff.updatedRows.filter((e) => isCompleted(e.csvRow.notes)).length} marking completed
            </span>
          )}
        </h4>
        {diff.updatedRows.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No updated orders</p>
        ) : (
          <div className="space-y-2">
            {diff.updatedRows.map((entry) => (
              <UpdatedRow
                key={entry.csvRow.kiewit_po}
                entry={entry}
                checked={selected.has(updatedRowKey(entry))}
                onToggle={() => toggle(updatedRowKey(entry))}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <button onClick={() => setShowUnchanged((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
          {showUnchanged ? "Hide" : "Show"} unchanged ({diff.unchangedRows.length})
        </button>
      </section>

      {diff.skippedCompletedRows.length > 0 && (
        <section>
          <button onClick={() => setShowSkipped((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
            {showSkipped ? "Hide" : "Show"} skipped — already complete ({diff.skippedCompletedRows.length})
          </button>
          {showSkipped && (
            <div className="mt-2 space-y-1">
              {diff.skippedCompletedRows.map((r) => (
                <p key={r.kiewit_po} className="text-xs text-gray-500">
                  {r.kiewit_po} — {r.site_id}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {diff.missingRows.length > 0 && (
        <section>
          <button onClick={() => setShowMissing((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
            {showMissing ? "Hide" : "Show"} not in this file ({diff.missingRows.length})
          </button>
          {showMissing && (
            <div className="mt-2 space-y-1">
              {diff.missingRows.map((r) => (
                <p key={r.id} className="text-xs text-gray-500">
                  {r.kiewit_po} — {r.site_id}
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function SupplierOrdersPage() {
  const getToken = useSupplierOrdersToken();
  const fileInputRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const [diff, setDiff] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyErrors, setApplyErrors] = useState([]);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [markingReceived, setMarkingReceived] = useState(false);

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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const csvRows = parseSupplierOrdersCsv(text);
    setDiff(computeSupplierOrdersDiff(csvRows, records));
    setApplyErrors([]);
  };

  const handleApply = async (selectedNewRows, selectedUpdatedRows) => {
    setApplying(true);
    const errors = [];
    try {
      const token = await getToken();

      const results = await Promise.allSettled([
        ...selectedNewRows.map((entry) => {
          const payload = PERSISTED_FIELDS.concat("kiewit_po").reduce((acc, f) => {
            acc[f] = entry.csvRow[f];
            return acc;
          }, {});
          return createSupplierOrder(payload, token);
        }),
        ...selectedUpdatedRows.map((entry) => {
          const payload = PERSISTED_FIELDS.concat("kiewit_po").reduce((acc, f) => {
            acc[f] = entry.csvRow[f];
            return acc;
          }, {});
          return updateSupplierOrder(entry.id, payload, token);
        }),
      ]);

      results.forEach((r) => {
        if (r.status === "rejected") errors.push(r.reason?.message || "A row failed to save");
      });

      setApplyErrors(errors);
      await refresh();
      if (errors.length === 0) setDiff(null);
    } finally {
      setApplying(false);
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

  const activeRows = records.filter((r) => !isCompleted(r.notes));
  const completedRows = records.filter((r) => isCompleted(r.notes));

  return (
    <div className="mt-8 px-4 pb-16">
      <div className="max-w-[1800px] mx-auto">
        <BackLink />
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-3xl font-bold leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Supplier Orders
            </span>
          </h1>
          <div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500"
            >
              Upload CSV
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {diff && (
            <ReviewPanel
              diff={diff}
              applying={applying}
              applyErrors={applyErrors}
              onApply={handleApply}
              onCancel={() => setDiff(null)}
            />
          )}

          {loading ? (
            <p className="text-sm text-gray-500 text-center py-10">Loading…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-bold text-pink-400 mb-3">Active Orders ({activeRows.length})</h2>
                <OrdersTable rows={activeRows} emptyLabel="No active orders" onRowClick={setSelectedOrder} />
              </section>

              {completedRows.length > 0 && (
                <section>
                  <button onClick={() => setShowCompleted((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
                    {showCompleted ? "Hide" : "Show"} completed ({completedRows.length})
                  </button>
                  {showCompleted && (
                    <div className="mt-3">
                      <OrdersTable rows={completedRows} emptyLabel="No completed orders" onRowClick={setSelectedOrder} />
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
        />
      )}
    </div>
  );
}
