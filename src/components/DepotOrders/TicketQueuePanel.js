import { motion } from "framer-motion";
import Badge from "./Badge";
import { formatDate, isOverdue } from "./dateHelpers";

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
const PRIORITY_COLOR = { high: "red", med: "amber", low: "gray" };
const STATUS_COLOR = { open: "blue", in_progress: "purple" };

const panelVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1, ease: "easeOut" },
  }),
};

function TicketCard({ ticket }) {
  const overdue = isOverdue(ticket.dueDate);
  return (
    <div className={`px-3.5 py-3 tv:px-5 tv:py-4 bg-gray-800 rounded-lg ${overdue ? "ring-1 ring-red-500/40" : ""}`}>
      <div className="flex items-start justify-between gap-3 tv:gap-3">
        <p className="text-sm tv:text-2xl font-semibold text-gray-100 break-words">{ticket.title}</p>
        {ticket.dueDate && (
          <p className={`text-xs tv:text-lg flex-shrink-0 whitespace-nowrap ${overdue ? "text-red-400 font-semibold" : "text-gray-500"}`}>
            Due {formatDate(ticket.dueDate)}
          </p>
        )}
      </div>
      <p className="mt-0.5 tv:mt-1.5 text-xs tv:text-lg text-gray-500 break-words">
        {ticket.submittedBy}
        {ticket.assignee ? ` → ${ticket.assignee}` : ""}
      </p>
      <div className="mt-2 tv:mt-3 flex flex-wrap gap-1.5 tv:gap-2">
        {overdue && <Badge color="red" size="lg">Overdue</Badge>}
        <Badge color={STATUS_COLOR[ticket.status] || "gray"} size="lg">
          {ticket.status.replace("_", " ")}
        </Badge>
        <Badge color={PRIORITY_COLOR[ticket.priority] || "gray"} size="lg">{ticket.priority}</Badge>
      </div>
    </div>
  );
}

export default function TicketQueuePanel({ tickets }) {
  const sorted = [...tickets].sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  return (
    <motion.div
      custom={2}
      initial="hidden"
      animate="visible"
      variants={panelVariants}
      className="bg-gray-900 rounded-xl shadow-lg border-l-4 border-l-purple-500 p-4 tv:p-5 h-full flex flex-col min-h-0"
    >
      <div className="flex-shrink-0 flex items-center gap-3 mb-3 tv:mb-4">
        <h2 className="text-lg tv:text-2xl font-bold text-purple-400">Depot Requests</h2>
        <span className="ml-auto text-sm tv:text-lg font-mono text-gray-500">{sorted.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 tv:space-y-2.5 pr-1">
        {sorted.length === 0 ? (
          <p className="text-sm tv:text-lg text-gray-600 italic">No open tickets</p>
        ) : (
          sorted.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
        )}
      </div>
    </motion.div>
  );
}