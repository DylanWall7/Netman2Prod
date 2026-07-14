import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import Badge from "./Badge";
import { formatDate, isOverdue } from "./dateHelpers";
import { getTickets, getActive, getCompleted } from "./depotOrdersApi";

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
const PRIORITY_COLOR = { high: "red", med: "amber", low: "gray" };
const STATUS_COLOR = { open: "blue", in_progress: "purple", completed: "green" };

const EMPTY_TICKET_FORM = { title: "", description: "", priority: "med", dueDate: "" };

function fieldClass() {
  return "w-full px-3 py-2 rounded-lg bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm";
}

function TicketForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_TICKET_FORM);
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
      <input
        className={fieldClass()}
        placeholder="What do you need?"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <textarea
        className={fieldClass()}
        placeholder="Details (optional)"
        rows={3}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          className={fieldClass()}
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
        >
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          className={fieldClass()}
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
        />
      </div>
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

function TicketItem({ ticket, onEdit, onClaim, onComplete, isBusy }) {
  const overdue = isOverdue(ticket.dueDate) && ticket.status !== "completed";
  return (
    <div className="px-4 py-3 bg-gray-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{ticket.title}</p>
          {ticket.description && (
            <p className="text-xs text-gray-500 mt-0.5">{ticket.description}</p>
          )}
          <p className="text-xs text-gray-600 mt-1">
            Submitted by {ticket.submittedBy}
            {ticket.assignee ? ` — claimed by ${ticket.assignee}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {ticket.dueDate && (
            <p className={`text-xs ${overdue ? "text-red-400 font-semibold" : "text-gray-500"}`}>
              Due {formatDate(ticket.dueDate)}
            </p>
          )}
          <div className="flex gap-1">
            {overdue && <Badge color="red">Overdue</Badge>}
            <Badge color={STATUS_COLOR[ticket.status] || "gray"}>{ticket.status.replace("_", " ")}</Badge>
            <Badge color={PRIORITY_COLOR[ticket.priority] || "gray"}>{ticket.priority}</Badge>
          </div>
          <div className="flex gap-2">
            {ticket.status === "open" && (
              <button
                onClick={() => onClaim(ticket)}
                disabled={isBusy}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600/80 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isBusy ? "Saving…" : "Claim"}
              </button>
            )}
            {ticket.status === "in_progress" && (
              <button
                onClick={() => onComplete(ticket)}
                disabled={isBusy}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-600/80 text-white hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isBusy ? "Saving…" : "Mark Complete"}
              </button>
            )}
            <button onClick={() => onEdit(ticket)} disabled={isBusy} className="text-xs text-gray-500 hover:text-pink-400 disabled:opacity-50">
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TicketManage({ records, onCreate, onUpdate }) {
  const { accounts } = useMsal();
  const currentUser = accounts[0]?.name || "Unknown";
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const tickets = getTickets(records);
  const activeTickets = [...getActive(tickets)].sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });
  const completedTickets = getCompleted(tickets);

  const saveTicket = async (form) => {
    if (editingTicket) {
      await onUpdate(editingTicket.id, { ...editingTicket, ...form });
      setEditingTicket(null);
    } else {
      await onCreate({
        recordType: "ticket",
        ...form,
        submittedBy: currentUser,
        submittedAt: new Date().toISOString(),
        assignee: null,
        status: "open",
        completedAt: null,
      });
      setShowAddTicket(false);
    }
  };

  const handleClaim = async (ticket) => {
    setBusyId(ticket.id);
    try {
      await onUpdate(ticket.id, { ...ticket, assignee: currentUser, status: "in_progress" });
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (ticket) => {
    setBusyId(ticket.id);
    try {
      await onUpdate(ticket.id, { ...ticket, status: "completed", completedAt: new Date().toISOString() });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-purple-400">Ticket Queue</h2>
        <button
          onClick={() => setShowAddTicket((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-black hover:bg-pink-500"
        >
          {showAddTicket ? "Cancel" : "+ Add Ticket"}
        </button>
      </div>
      {showAddTicket && <TicketForm onSave={saveTicket} onCancel={() => setShowAddTicket(false)} />}
      {editingTicket && <TicketForm initial={editingTicket} onSave={saveTicket} onCancel={() => setEditingTicket(null)} />}
      {activeTickets.length === 0 ? (
        <p className="text-sm text-gray-600 italic">No open tickets</p>
      ) : (
        <div className="space-y-2">
          {activeTickets.map((ticket) => (
            <TicketItem
              key={ticket.id}
              ticket={ticket}
              onEdit={setEditingTicket}
              onClaim={handleClaim}
              onComplete={handleComplete}
              isBusy={busyId === ticket.id}
            />
          ))}
        </div>
      )}
      {completedTickets.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowCompleted((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
            {showCompleted ? "Hide" : "Show"} completed ({completedTickets.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 mt-2">
              {completedTickets.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  onEdit={setEditingTicket}
                  onClaim={handleClaim}
                  onComplete={handleComplete}
                  isBusy={busyId === ticket.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
