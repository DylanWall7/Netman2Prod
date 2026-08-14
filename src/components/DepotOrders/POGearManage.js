import { useRef, useState } from "react";
import Badge from "./Badge";
import SiteAutocomplete from "./SiteAutocomplete";
import RichNotesEditor from "./RichNotesEditor";
import RichNotesDisplay from "./RichNotesDisplay";
import { formatDate, today } from "./dateHelpers";
import { getPOs, getGearReturns, getActive, getCompleted } from "./depotOrdersApi";
import { useSnipeitToken, listSnipeitLocations, listSnipeitModels, getSnipeitAssetBySerial } from "./snipeitApi";
import { checkAndStrikeReturnedGear, buildModelExclusionSet } from "./gearReturnCheck";

const PO_STATUS_COLOR = { ordered: "gray", shipped: "blue", received: "green" };
const GEAR_STATUS_COLOR = { out: "amber", returned: "green" };
const PO_NEXT_STATUS = { ordered: "shipped", shipped: "received" };

const EMPTY_PO_FORM = { poNumber: "", vendor: "", description: "", qty: 1, expectedDate: "", siteCode: "" };
const EMPTY_GEAR_FORM = { description: "", site: "", heldBy: "", expectedReturnDate: "", notes: "" };

function fieldClass() {
  return "w-full px-3 py-2 rounded-lg bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm";
}

function POForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial || { ...EMPTY_PO_FORM, expectedDate: today() });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <input className={fieldClass()} placeholder="PO Number" value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} />
        <input className={fieldClass()} placeholder="Vendor" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
      </div>
      <input className={fieldClass()} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <SiteAutocomplete value={form.siteCode} onChange={(siteCode) => setForm((f) => ({ ...f, siteCode }))} />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" min="1" className={fieldClass()} placeholder="Qty" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))} />
        <input type="date" className={fieldClass()} value={form.expectedDate} onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))} />
      </div>
      {initial && (
        <select
          className={fieldClass()}
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="ordered">Ordered</option>
          <option value="shipped">Shipped</option>
          <option value="received">Received</option>
        </select>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5">
          {saving && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function GearForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial || { ...EMPTY_GEAR_FORM, expectedReturnDate: today() });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3 mb-3">
      <input className={fieldClass()} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <input className={fieldClass()} placeholder="Site" value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))} />
        <input className={fieldClass()} placeholder="Held By" value={form.heldBy} onChange={(e) => setForm((f) => ({ ...f, heldBy: e.target.value }))} />
      </div>
      <input type="date" className={fieldClass()} value={form.expectedReturnDate} onChange={(e) => setForm((f) => ({ ...f, expectedReturnDate: e.target.value }))} />
      {initial && (
        <select
          className={fieldClass()}
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="out">Out</option>
          <option value="returned">Returned</option>
        </select>
      )}
      <RichNotesEditor
        value={form.notes}
        onChange={(html) => setForm((f) => ({ ...f, notes: html }))}
        placeholder="Notes — paste the list of gear that needs to come back"
        rows={4}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5">
          {saving && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function POItem({ po, onEdit, onAdvance, isBusy }) {
  const nextStatus = PO_NEXT_STATUS[po.status];
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-100 truncate">
          {po.poNumber} — {po.vendor} ({po.qty})
        </p>
        <p className="text-xs text-gray-500 truncate">
          {po.description}
          {po.siteCode ? ` — ${po.siteCode}` : ""}
        </p>
      </div>
      <p className="text-xs flex-shrink-0 text-gray-500">
        {formatDate(po.expectedDate)}
      </p>
      <Badge color={PO_STATUS_COLOR[po.status] || "gray"}>{po.status}</Badge>
      {nextStatus && (
        <button
          onClick={() => onAdvance(po, nextStatus)}
          disabled={isBusy}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-600/80 text-white hover:bg-green-600 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {isBusy ? "Saving…" : `Mark ${nextStatus}`}
        </button>
      )}
      <button onClick={() => onEdit(po)} disabled={isBusy} className="text-xs text-gray-500 hover:text-pink-400 flex-shrink-0 disabled:opacity-50">
        Edit
      </button>
    </div>
  );
}

function GearItem({ item, onEdit, onAdvance, onCheck, isBusy, isChecking, checkResult }) {
  return (
    <div className="px-4 py-3 bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{item.description}</p>
          <p className="text-xs text-gray-500 truncate">
            {item.site} — held by {item.heldBy}
          </p>
        </div>
        <p className="text-xs flex-shrink-0 text-gray-500">
          {formatDate(item.expectedReturnDate)}
        </p>
        <Badge color={GEAR_STATUS_COLOR[item.status] || "gray"}>{item.status}</Badge>
        {item.status === "out" && item.notes && (
          <button
            onClick={() => onCheck(item)}
            disabled={isBusy || isChecking}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600/80 text-white hover:bg-blue-600 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isChecking && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isChecking ? "Checking…" : "Check Snipe-IT"}
          </button>
        )}
        {item.status === "out" && (
          <button
            onClick={() => onAdvance(item, "returned")}
            disabled={isBusy}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-600/80 text-white hover:bg-green-600 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isBusy ? "Saving…" : "Mark Returned"}
          </button>
        )}
        <button onClick={() => onEdit(item)} disabled={isBusy} className="text-xs text-gray-500 hover:text-pink-400 flex-shrink-0 disabled:opacity-50">
          Edit
        </button>
      </div>
      {item.notes && (
        <RichNotesDisplay
          html={item.notes}
          className="mt-2 pt-2 border-t border-gray-600/50 text-xs text-gray-400 whitespace-pre-wrap"
        />
      )}
      {checkResult && (
        <p className={`mt-1.5 text-xs ${checkResult.error ? "text-red-400" : "text-blue-300"}`}>
          {checkResult.error || checkResult.message}
        </p>
      )}
    </div>
  );
}

export default function POGearManage({ records, onCreate, onUpdate }) {
  const [showAddPO, setShowAddPO] = useState(false);
  const [showAddGear, setShowAddGear] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [editingGear, setEditingGear] = useState(null);
  const [showCompletedPO, setShowCompletedPO] = useState(false);
  const [showCompletedGear, setShowCompletedGear] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [checkResults, setCheckResults] = useState({});
  const getSnipeitToken = useSnipeitToken();
  const snipeitMetaRef = useRef(null);

  const pos = getPOs(records);
  const gear = getGearReturns(records);
  const activePOs = getActive(pos);
  const completedPOs = getCompleted(pos);
  const activeGear = getActive(gear);
  const completedGear = getCompleted(gear);

  const savePO = async (form) => {
    if (editingPO) {
      await onUpdate(editingPO.id, {
        ...editingPO,
        ...form,
        completedAt: form.status === "received" ? new Date().toISOString() : null,
      });
      setEditingPO(null);
    } else {
      await onCreate({
        recordType: "po",
        ...form,
        status: "ordered",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      setShowAddPO(false);
    }
  };

  const saveGear = async (form) => {
    if (editingGear) {
      await onUpdate(editingGear.id, {
        ...editingGear,
        ...form,
        completedAt: form.status === "returned" ? new Date().toISOString() : null,
      });
      setEditingGear(null);
    } else {
      await onCreate({
        recordType: "gear_return",
        ...form,
        status: "out",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      setShowAddGear(false);
    }
  };

  const advancePO = async (po, nextStatus) => {
    setBusyId(po.id);
    try {
      await onUpdate(po.id, {
        ...po,
        status: nextStatus,
        completedAt: nextStatus === "received" ? new Date().toISOString() : null,
      });
    } finally {
      setBusyId(null);
    }
  };

  const advanceGear = async (item, nextStatus) => {
    setBusyId(item.id);
    try {
      await onUpdate(item.id, {
        ...item,
        status: nextStatus,
        completedAt: nextStatus === "returned" ? new Date().toISOString() : null,
      });
    } finally {
      setBusyId(null);
    }
  };

  const checkSnipeit = async (item) => {
    setCheckingId(item.id);
    setCheckResults((r) => ({ ...r, [item.id]: null }));
    try {
      const token = await getSnipeitToken();
      if (!snipeitMetaRef.current) {
        const [locations, models] = await Promise.all([listSnipeitLocations(token), listSnipeitModels(token)]);
        snipeitMetaRef.current = { locations, modelExclusionSet: buildModelExclusionSet(models) };
      }
      const { locations, modelExclusionSet } = snipeitMetaRef.current;

      const outcome = await checkAndStrikeReturnedGear(item.notes, {
        siteName: item.site,
        locations,
        modelExclusionSet,
        lookupBySerial: (serial) => getSnipeitAssetBySerial(serial, token),
      });

      if (outcome.html !== item.notes) {
        await onUpdate(item.id, { ...item, notes: outcome.html });
      }

      const parts = [];
      if (outcome.struckLines) parts.push(`${outcome.struckLines} confirmed moved off site`);
      if (outcome.unstruckLines) parts.push(`${outcome.unstruckLines} reverted (still at site)`);
      if (outcome.ambiguousLines) parts.push(`${outcome.ambiguousLines} ambiguous`);
      if (outcome.notFoundLines) parts.push(`${outcome.notFoundLines} not found`);
      if (outcome.unresolvedLines) parts.push(`${outcome.unresolvedLines} unresolved`);
      const message =
        outcome.checkedLines === 0 ? "Nothing to check" : `Checked ${outcome.checkedLines} — ${parts.join(", ") || "no changes"}`;
      setCheckResults((r) => ({ ...r, [item.id]: { message } }));
    } catch (err) {
      setCheckResults((r) => ({ ...r, [item.id]: { error: err.message || "Check failed" } }));
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Manual PO tracking disabled — POs are now tracked via the weekly supplier CSV upload
          (Supplier Orders page). Uncomment this section to bring manual PO entry back.
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-blue-400">Purchase Orders</h2>
          <button
            onClick={() => setShowAddPO((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500"
          >
            {showAddPO ? "Cancel" : "+ Add PO"}
          </button>
        </div>
        {showAddPO && <POForm onSave={savePO} onCancel={() => setShowAddPO(false)} />}
        {editingPO && <POForm initial={editingPO} onSave={savePO} onCancel={() => setEditingPO(null)} />}
        {activePOs.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No open POs</p>
        ) : (
          <div className="space-y-2">
            {activePOs.map((po) => (
              <POItem key={po.id} po={po} onEdit={setEditingPO} onAdvance={advancePO} isBusy={busyId === po.id} />
            ))}
          </div>
        )}
        {completedPOs.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowCompletedPO((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
              {showCompletedPO ? "Hide" : "Show"} completed ({completedPOs.length})
            </button>
            {showCompletedPO && (
              <div className="space-y-2 mt-2">
                {completedPOs.map((po) => (
                  <POItem key={po.id} po={po} onEdit={setEditingPO} onAdvance={advancePO} isBusy={busyId === po.id} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      */}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-amber-400">Gear Returns</h2>
          <button
            onClick={() => setShowAddGear((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500"
          >
            {showAddGear ? "Cancel" : "+ Add Gear"}
          </button>
        </div>
        {showAddGear && <GearForm onSave={saveGear} onCancel={() => setShowAddGear(false)} />}
        {activeGear.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No gear out</p>
        ) : (
          <div className="space-y-2">
            {activeGear.map((item) =>
              editingGear?.id === item.id ? (
                <GearForm key={item.id} initial={editingGear} onSave={saveGear} onCancel={() => setEditingGear(null)} />
              ) : (
                <GearItem
                  key={item.id}
                  item={item}
                  onEdit={setEditingGear}
                  onAdvance={advanceGear}
                  onCheck={checkSnipeit}
                  isBusy={busyId === item.id}
                  isChecking={checkingId === item.id}
                  checkResult={checkResults[item.id]}
                />
              ),
            )}
          </div>
        )}
        {completedGear.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowCompletedGear((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
              {showCompletedGear ? "Hide" : "Show"} completed ({completedGear.length})
            </button>
            {showCompletedGear && (
              <div className="space-y-2 mt-2">
                {completedGear.map((item) =>
                  editingGear?.id === item.id ? (
                    <GearForm key={item.id} initial={editingGear} onSave={saveGear} onCancel={() => setEditingGear(null)} />
                  ) : (
                    <GearItem key={item.id} item={item} onEdit={setEditingGear} onAdvance={advanceGear} isBusy={busyId === item.id} />
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
