import { useEffect, useRef, useState, useCallback } from "react";
import BackLink from "./BackLink";
import POGearPanel from "./POGearPanel";
import TicketQueuePanel from "./TicketQueuePanel";
import { unlockAudio, playNewRequestSound } from "./alertSound";
import {
  listRecords,
  getActive,
  getPOs,
  getGearReturns,
  getTickets,
  useDepotOrdersToken,
} from "./depotOrdersApi";
import { listSupplierOrders, useSupplierOrdersToken } from "./supplierOrdersApi";
import { isCompleted } from "./supplierOrdersCsv";

const POLL_INTERVAL_MS = 30000;

function toPOCard(order) {
  return {
    id: `supplier-${order.id}`,
    poNumber: order.kiewit_po,
    vendor: order.requestor,
    siteCode: order.site_id,
    expectedDate: order.order_date,
    status: order.tracking ? "shipped" : "ordered",
  };
}

export default function DashboardPage() {
  const getToken = useDepotOrdersToken();
  const getSupplierOrdersToken = useSupplierOrdersToken();
  const containerRef = useRef(null);
  const seenTicketIdsRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await listRecords(token);
      const ticketIds = new Set(getTickets(data).map((t) => t.id));
      if (seenTicketIdsRef.current) {
        const hasNewTicket = [...ticketIds].some((id) => !seenTicketIdsRef.current.has(id));
        if (hasNewTicket) playNewRequestSound();
      }
      seenTicketIdsRef.current = ticketIds;
      setRecords(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    }

    try {
      const supplierToken = await getSupplierOrdersToken();
      setSupplierOrders(await listSupplierOrders(supplierToken));
    } catch (err) {
      console.error("Failed to load supplier orders", err);
    }
  }, [getToken, getSupplierOrdersToken]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = () => {
    unlockAudio();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  const active = getActive(records);
  const activeSupplierOrders = supplierOrders.filter((r) => !isCompleted(r.notes) && !r.received);
  const pos = [...getPOs(active), ...activeSupplierOrders.map(toPOCard)];

  return (
    <div
      ref={containerRef}
      onClick={unlockAudio}
      className="h-screen overflow-hidden bg-pink-100 px-4 tv:px-6 py-4 tv:py-5 flex flex-col"
    >
      <div className="flex-shrink-0">
        {!isFullscreen && <BackLink />}
        <div className="flex items-center justify-between mb-4 tv:mb-5">
          <div>
            <h1 className="text-2xl tv:text-4xl font-bold leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
                Depot Dashboard
              </span>
            </h1>
            {lastUpdated && (
              <p className="flex items-center gap-2 text-xs tv:text-sm text-gray-500 mt-1 tv:mt-1.5">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
                </span>
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 tv:px-4 tv:py-2 tv:text-base text-sm font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 tv:gap-5">
        <POGearPanel pos={pos} gearReturns={getGearReturns(active)} />
        <TicketQueuePanel tickets={getTickets(active)} />
      </div>
    </div>
  );
}