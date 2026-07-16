import { motion } from "framer-motion";
import Badge from "./Badge";
import RichNotesDisplay from "./RichNotesDisplay";
import { formatDate } from "./dateHelpers";

const PO_STATUS_COLOR = { ordered: "gray", shipped: "blue", received: "green" };
const GEAR_STATUS_COLOR = { out: "amber", returned: "green" };

const panelVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1, ease: "easeOut" },
  }),
};

function PanelShell({ accent, headerText, title, count, custom, children }) {
  return (
    <motion.div
      custom={custom}
      initial="hidden"
      animate="visible"
      variants={panelVariants}
      className={`bg-gray-900 rounded-xl shadow-lg border-l-4 ${accent} p-4 tv:p-5 h-full flex flex-col min-h-0`}
    >
      <div className="flex-shrink-0 flex items-center gap-3 mb-3 tv:mb-4">
        <h2 className={`text-lg tv:text-2xl font-bold ${headerText}`}>{title}</h2>
        <span className="ml-auto text-sm tv:text-lg font-mono text-gray-500">{count}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 tv:space-y-2.5 pr-1">{children}</div>
    </motion.div>
  );
}

function POCard({ po }) {
  return (
    <div className="px-3.5 py-3 tv:px-5 tv:py-4 bg-gray-800 rounded-lg">
      <div className="flex items-start justify-between gap-3 tv:gap-3">
        <p className="text-sm tv:text-2xl font-semibold text-gray-100 break-words">
          {po.poNumber} — {po.vendor}
        </p>
        <p className="text-xs tv:text-lg flex-shrink-0 whitespace-nowrap text-gray-500">
          {formatDate(po.expectedDate)}
        </p>
      </div>
      {(po.description || po.siteCode) && (
        <p className="mt-0.5 tv:mt-1.5 text-xs tv:text-lg text-gray-500 break-words">
          {po.description}
          {po.siteCode ? ` — ${po.siteCode}` : ""}
        </p>
      )}
      <div className="mt-2 tv:mt-3 flex flex-wrap gap-1.5 tv:gap-2">
        <Badge color={PO_STATUS_COLOR[po.status] || "gray"} size="lg">{po.status}</Badge>
      </div>
    </div>
  );
}

function GearCard({ item }) {
  return (
    <div className="px-3.5 py-3 tv:px-5 tv:py-4 bg-gray-800 rounded-lg">
      <div className="flex items-start justify-between gap-3 tv:gap-3">
        <p className="text-sm tv:text-2xl font-semibold text-gray-100 break-words">{item.description}</p>
        <p className="text-xs tv:text-lg flex-shrink-0 whitespace-nowrap text-gray-500">
          {formatDate(item.expectedReturnDate)}
        </p>
      </div>
      <p className="mt-0.5 tv:mt-1.5 text-xs tv:text-lg text-gray-500 break-words">
        {item.site} — held by {item.heldBy}
      </p>
      <div className="mt-2 tv:mt-3 flex flex-wrap gap-1.5 tv:gap-2">
        <Badge color={GEAR_STATUS_COLOR[item.status] || "gray"} size="lg">{item.status}</Badge>
      </div>
      {item.notes && (
        <RichNotesDisplay
          html={item.notes}
          className="mt-2 pt-2 tv:mt-3 tv:pt-3 border-t border-gray-700 text-xs tv:text-lg text-gray-500 break-words whitespace-pre-wrap"
        />
      )}
    </div>
  );
}

export default function POGearPanel({ pos, gearReturns }) {
  const sortedPOs = [...pos].sort(
    (a, b) => new Date(a.expectedDate) - new Date(b.expectedDate),
  );
  const sortedGear = [...gearReturns].sort(
    (a, b) => new Date(a.expectedReturnDate) - new Date(b.expectedReturnDate),
  );

  return (
    <>
      <PanelShell accent="border-l-blue-500" headerText="text-blue-400" title="Purchase Orders" count={sortedPOs.length} custom={0}>
        {sortedPOs.length === 0 ? (
          <p className="text-sm tv:text-lg text-gray-600 italic">No open POs</p>
        ) : (
          sortedPOs.map((po) => <POCard key={po.id} po={po} />)
        )}
      </PanelShell>

      <PanelShell accent="border-l-amber-500" headerText="text-amber-400" title="Gear Returns" count={sortedGear.length} custom={1}>
        {sortedGear.length === 0 ? (
          <p className="text-sm tv:text-lg text-gray-600 italic">No gear out</p>
        ) : (
          sortedGear.map((item) => <GearCard key={item.id} item={item} />)
        )}
      </PanelShell>
    </>
  );
}
