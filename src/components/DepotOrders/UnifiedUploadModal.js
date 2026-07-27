import { useEffect, useMemo, useState } from "react";
import { computeSupplierOrdersDiff, FIELD_LABELS, PERSISTED_FIELDS } from "./supplierOrdersCsv";
import { createSupplierOrder, updateSupplierOrder, useSupplierOrdersToken } from "./supplierOrdersApi";
import { buildDeviceStagePlan } from "./poTabsStaging";
import {
  listSnipeitHardwareByModel,
  createSnipeitAsset,
  updateSnipeitAsset,
  useSnipeitToken,
  PO_NUMBER_CUSTOM_FIELD,
} from "./snipeitApi";

const PENDING_SHIPMENT_STATUS_ID = 16;
const DELIVERED_STATUS_ID = 17;
const UNKNOWN_LOST_STATUS_ID = 10;
const SAFE_TO_UPGRADE_STATUS_IDS = [PENDING_SHIPMENT_STATUS_ID, UNKNOWN_LOST_STATUS_ID];
const APPLY_CONCURRENCY = 20;

function isDeliveredStatus(shipmentStatus) {
  return String(shipmentStatus || "").trim().toLowerCase() === "delivered";
}

function orderKey(entry, prefix) {
  return `${prefix}:${entry.csvRow.kiewit_po}||${entry.csvRow.order_date || ""}`;
}

function deviceKey(item) {
  return `${item.poNumber}||${item.sheetName}||${item.productCode}||${item.lineIndex}`;
}

function itemNeedsAction(item, modelId, existingBySerial) {
  if (!modelId) return true;
  const delivered = isDeliveredStatus(item.shipmentStatus);
  return item.serials.some((serial) => {
    const existing = existingBySerial.get(serial);
    if (!existing) return true;
    const currentPO = existing.custom_fields?.poNumber?.value;
    if (currentPO !== item.poNumber) return true;
    if (delivered && DELIVERED_STATUS_ID && SAFE_TO_UPGRADE_STATUS_IDS.includes(Number(existing.status_label?.id))) {
      return true;
    }
    return false;
  });
}

async function runWithConcurrency(taskFns, limit) {
  const queue = [...taskFns];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) await task();
    }
  });
  await Promise.all(workers);
}

function OrderRow({ entry, kind, checked, onToggle }) {
  const { csvRow, changes } = entry;
  return (
    <label className="flex items-start gap-3 px-4 py-2.5 bg-gray-700/50 rounded-lg cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 accent-pink-600" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-100">
          {csvRow.kiewit_po} — {csvRow.site_id}
        </p>
        {kind === "new" ? (
          <p className="text-xs text-gray-500">
            {csvRow.requestor} — Quote {csvRow.Quote_Number} — {csvRow.order_date}
          </p>
        ) : (
          <div className="mt-1 space-y-0.5">
            {changes.map((c) => (
              <p key={c.field} className="text-xs">
                <span className="text-gray-500">{FIELD_LABELS[c.field]}:</span>{" "}
                <span className="text-red-400 line-through">{c.from || "—"}</span>{" "}
                <span className="text-gray-600">→</span> <span className="text-green-400">{c.to || "—"}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

function ModelPicker({ models, resolution, modelId, onChange }) {
  const [filter, setFilter] = useState("");
  const selectedModel = models.find((m) => m.id === modelId);
  const filtered = filter
    ? models
        .filter((m) => `${m.name} ${m.model_number || ""}`.toLowerCase().includes(filter.toLowerCase()))
        .slice(0, 20)
    : (resolution.suggestions || []).map((s) => s.model);

  return (
    <div>
      {selectedModel ? (
        <p className="text-xs text-green-400">✓ {selectedModel.name}</p>
      ) : (
        <p className="text-xs text-red-400">No model selected</p>
      )}
      <div className="relative mt-1">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search models to change…"
          className="w-full px-2 py-1 rounded bg-gray-700 text-gray-100 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
        {(filter || (!selectedModel && filtered.length > 0)) && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 rounded shadow-lg">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setFilter("");
                }}
                className="block w-full text-left px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
              >
                {m.name} {m.model_number ? `(${m.model_number})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SerialsPopup({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] min-h-0 overflow-y-auto bg-gray-800 rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-100">
            {item.poNumber} — {item.productCode}
            <span className="text-gray-500 font-normal"> ({item.serials.length} serial(s))</span>
          </h4>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            ×
          </button>
        </div>
        <ul className="space-y-1 text-xs text-gray-300 font-mono">
          {item.serials.map((serial) => (
            <li key={serial} className="px-2 py-1 rounded bg-gray-900/60">
              {serial}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeviceRow({ item, models, checked, onToggle, modelId, onModelChange }) {
  const [showSerials, setShowSerials] = useState(false);
  return (
    <tr className="text-gray-300 align-top">
      <td className="pr-3 py-2">
        <input type="checkbox" checked={checked} disabled={!modelId} onChange={onToggle} className="mt-1 accent-pink-600" />
      </td>
      <td className="pr-3 py-2 whitespace-nowrap">{item.poNumber}</td>
      <td className="pr-3 py-2 whitespace-nowrap">{item.productCode}</td>
      <td className="pr-3 py-2 whitespace-nowrap">{item.shipmentStatus}</td>
      <td className="pr-3 py-2 whitespace-nowrap">
        <button
          onClick={() => setShowSerials(true)}
          className="underline decoration-dotted text-blue-400 hover:text-blue-300"
        >
          {item.serials.length}
        </button>
        {showSerials && <SerialsPopup item={item} onClose={() => setShowSerials(false)} />}
      </td>
      <td className="pr-3 py-2 w-64">
        <ModelPicker models={models} resolution={item.modelResolution} modelId={modelId} onChange={onModelChange} />
      </td>
    </tr>
  );
}

export default function UnifiedUploadModal({ csvRows, poTabResults, models, records, onClose, onApplied }) {
  const getSupplierOrdersToken = useSupplierOrdersToken();
  const getSnipeitToken = useSnipeitToken();

  const diff = useMemo(() => computeSupplierOrdersDiff(csvRows, records), [csvRows, records]);
  const stagePlan = useMemo(() => buildDeviceStagePlan(poTabResults, models), [poTabResults, models]);

  const [selectedOrders, setSelectedOrders] = useState(() => {
    const initial = new Set();
    diff.newRows.forEach((e) => initial.add(orderKey(e, "new")));
    diff.updatedRows.forEach((e) => initial.add(orderKey(e, "updated")));
    return initial;
  });

  const [pickedModelIds, setPickedModelIds] = useState(() => {
    const initial = {};
    for (const item of stagePlan.activeItems) {
      const key = deviceKey(item);
      if (item.modelResolution.status === "exact") initial[key] = item.modelResolution.model.id;
      else if (item.modelResolution.status === "suggested") initial[key] = item.modelResolution.suggestions[0].model.id;
    }
    return initial;
  });

  const [existingBySerial, setExistingBySerial] = useState(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [preflightError, setPreflightError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPreflightLoading(true);
      setPreflightError(null);
      try {
        const token = await getSnipeitToken();
        const uniqueModelIds = [
          ...new Set(stagePlan.activeItems.map((item) => pickedModelIds[deviceKey(item)]).filter(Boolean)),
        ];
        const map = new Map();
        await Promise.all(
          uniqueModelIds.map(async (modelId) => {
            const hardware = await listSnipeitHardwareByModel(modelId, token);
            hardware.forEach((asset) => map.set(asset.serial, asset));
          }),
        );
        if (!cancelled) setExistingBySerial(map);
      } catch (err) {
        if (!cancelled) setPreflightError(err.message || "Failed to check existing devices");
      } finally {
        if (!cancelled) setPreflightLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagePlan.activeItems]);

  const visibleDeviceItems = useMemo(() => {
    if (!existingBySerial) return [];
    return stagePlan.activeItems.filter((item) =>
      itemNeedsAction(item, pickedModelIds[deviceKey(item)], existingBySerial),
    );
  }, [stagePlan.activeItems, existingBySerial, pickedModelIds]);

  const [selectedDevices, setSelectedDevices] = useState(() => {
    const initial = new Set();
    for (const item of stagePlan.activeItems) {
      if (item.modelResolution.status === "exact") initial.add(deviceKey(item));
    }
    return initial;
  });

  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState(null);

  const toggleOrder = (key) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleDevice = (key) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setDeviceModelId = (key, modelId) => {
    setPickedModelIds((prev) => ({ ...prev, [key]: modelId }));
  };

  const handleApplyEverything = async () => {
    setApplying(true);
    setErrors([]);
    setSummary(null);
    const errs = [];

    const selectedNewOrders = diff.newRows.filter((e) => selectedOrders.has(orderKey(e, "new")));
    const selectedUpdatedOrders = diff.updatedRows.filter((e) => selectedOrders.has(orderKey(e, "updated")));
    const selectedDeviceRows = visibleDeviceItems
      .map((item) => ({ item, key: deviceKey(item), modelId: pickedModelIds[deviceKey(item)] }))
      .filter((r) => selectedDevices.has(r.key) && r.modelId);

    const deviceSerialTotal = selectedDeviceRows.reduce((sum, r) => sum + r.item.serials.length, 0);
    const total = selectedNewOrders.length + selectedUpdatedOrders.length + deviceSerialTotal;
    let done = 0;
    setProgress({ done: 0, total });

    let ordersCreated = 0;
    let ordersUpdated = 0;
    let devicesCreated = 0;
    let devicesUpdated = 0;
    let devicesUnchanged = 0;

    try {
      const ordersToken = await getSupplierOrdersToken();

      const orderTasks = [
        ...selectedNewOrders.map((entry) => async () => {
          const payload = PERSISTED_FIELDS.concat("kiewit_po").reduce((acc, f) => {
            acc[f] = entry.csvRow[f];
            return acc;
          }, {});
          try {
            await createSupplierOrder(payload, ordersToken);
            ordersCreated += 1;
          } catch (err) {
            errs.push(`Order ${entry.csvRow.kiewit_po}: ${err.message}`);
          } finally {
            done += 1;
            setProgress({ done, total });
          }
        }),
        ...selectedUpdatedOrders.map((entry) => async () => {
          const payload = PERSISTED_FIELDS.concat("kiewit_po").reduce((acc, f) => {
            acc[f] = entry.csvRow[f];
            return acc;
          }, {});
          try {
            await updateSupplierOrder(entry.id, payload, ordersToken);
            ordersUpdated += 1;
          } catch (err) {
            errs.push(`Order ${entry.csvRow.kiewit_po}: ${err.message}`);
          } finally {
            done += 1;
            setProgress({ done, total });
          }
        }),
      ];

      await Promise.allSettled(orderTasks.map((fn) => fn()));

      if (selectedDeviceRows.length > 0) {
        const snipeitToken = await getSnipeitToken();

        const deviceTasks = selectedDeviceRows.flatMap((r) =>
          r.item.serials.map((serial) => async () => {
            try {
              const delivered = isDeliveredStatus(r.item.shipmentStatus);
              const existing = existingBySerial.get(serial) || null;
              if (existing) {
                const updatePayload = {};
                const currentPO = existing.custom_fields?.poNumber?.value;
                if (currentPO !== r.item.poNumber) {
                  updatePayload[PO_NUMBER_CUSTOM_FIELD] = r.item.poNumber;
                }
                if (
                  delivered &&
                  DELIVERED_STATUS_ID &&
                  SAFE_TO_UPGRADE_STATUS_IDS.includes(Number(existing.status_label?.id))
                ) {
                  updatePayload.status_id = DELIVERED_STATUS_ID;
                }
                if (Object.keys(updatePayload).length === 0) {
                  devicesUnchanged += 1;
                } else {
                  await updateSnipeitAsset(serial, updatePayload, snipeitToken);
                  devicesUpdated += 1;
                }
              } else {
                await createSnipeitAsset(
                  {
                    serial,
                    asset_tag: serial,
                    model_id: r.modelId,
                    status_id: delivered ? DELIVERED_STATUS_ID : PENDING_SHIPMENT_STATUS_ID,
                    [PO_NUMBER_CUSTOM_FIELD]: r.item.poNumber,
                  },
                  snipeitToken,
                );
                devicesCreated += 1;
              }
            } catch (err) {
              errs.push(`${serial} (${r.item.productCode}, PO ${r.item.poNumber}): ${err.message}`);
            } finally {
              done += 1;
              setProgress({ done, total });
            }
          }),
        );

        await runWithConcurrency(deviceTasks, APPLY_CONCURRENCY);
      }

      setSummary({ ordersCreated, ordersUpdated, devicesCreated, devicesUpdated, devicesUnchanged });
      setErrors(errs);
      onApplied?.();
    } finally {
      setApplying(false);
    }
  };

  const selectedDeviceSerialCount = visibleDeviceItems
    .filter((item) => selectedDevices.has(deviceKey(item)))
    .reduce((sum, item) => sum + item.serials.length, 0);
  const alreadyCorrectCount = existingBySerial ? stagePlan.activeItems.length - visibleDeviceItems.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-[85vw] max-h-[95vh] min-h-0 overflow-y-auto bg-gray-800 rounded-xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-100">Review Weekly Upload</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            ×
          </button>
        </div>

        {summary && (
          <div className="px-3 py-2 rounded-lg bg-green-900/40 border border-green-500/50 text-green-300 text-sm">
            {summary.ordersCreated} order(s) created, {summary.ordersUpdated} updated. {summary.devicesCreated} device(s)
            created, {summary.devicesUpdated} updated, {summary.devicesUnchanged} already up to date.
          </div>
        )}

        {errors.length > 0 && (
          <div className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-xs space-y-1 max-h-32 overflow-y-auto">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        <section>
          <h4 className="text-sm font-bold text-pink-400 mb-2">
            Orders — {diff.newRows.length} new, {diff.updatedRows.length} updated
          </h4>
          <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
            {diff.newRows.map((entry) => (
              <OrderRow
                key={orderKey(entry, "new")}
                entry={entry}
                kind="new"
                checked={selectedOrders.has(orderKey(entry, "new"))}
                onToggle={() => toggleOrder(orderKey(entry, "new"))}
              />
            ))}
            {diff.updatedRows.map((entry) => (
              <OrderRow
                key={orderKey(entry, "updated")}
                entry={entry}
                kind="updated"
                checked={selectedOrders.has(orderKey(entry, "updated"))}
                onToggle={() => toggleOrder(orderKey(entry, "updated"))}
              />
            ))}
            {diff.newRows.length === 0 && diff.updatedRows.length === 0 && (
              <p className="text-sm text-gray-600 italic">No order changes</p>
            )}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-bold text-blue-400 mb-2">
            Devices — {stagePlan.skippedTabs.length} PO(s) skipped (already complete)
            {!preflightLoading && `, ${alreadyCorrectCount} line item(s) already correct (hidden)`}
          </h4>
          {preflightError && (
            <p className="text-xs text-red-400 mb-2">{preflightError}</p>
          )}
          {preflightLoading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-900/20 border border-blue-500/30 text-sm text-blue-300">
              <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              Checking existing devices in Snipe-IT…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700 max-h-[40vh] overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-900 text-gray-500 sticky top-0">
                  <tr>
                    <th className="pr-3 py-2 pl-3"></th>
                    <th className="text-left pr-3 py-2">PO</th>
                    <th className="text-left pr-3 py-2">Product Code</th>
                    <th className="text-left pr-3 py-2">Status</th>
                    <th className="text-left pr-3 py-2">Serials</th>
                    <th className="text-left pr-3 py-2">Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {visibleDeviceItems.map((item) => {
                    const key = deviceKey(item);
                    return (
                      <DeviceRow
                        key={key}
                        item={item}
                        models={models}
                        checked={selectedDevices.has(key)}
                        onToggle={() => toggleDevice(key)}
                        modelId={pickedModelIds[key]}
                        onModelChange={(modelId) => setDeviceModelId(key, modelId)}
                      />
                    );
                  })}
                  {visibleDeviceItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-gray-600 italic">
                        Nothing needs attention — all devices already correct
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-3">
          {applying && (
            <span className="text-xs text-gray-400">
              {progress.done} / {progress.total}…
            </span>
          )}
          <button
            onClick={handleApplyEverything}
            disabled={applying || preflightLoading || (selectedOrders.size === 0 && selectedDeviceSerialCount === 0)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {applying && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
            {applying
              ? "Applying…"
              : `Apply Everything (${selectedOrders.size} orders, ${selectedDeviceSerialCount} devices)`}
          </button>
        </div>
      </div>
    </div>
  );
}
