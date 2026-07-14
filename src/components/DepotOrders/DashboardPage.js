import { useEffect, useRef, useState, useCallback } from "react";
import BackLink from "./BackLink";
import POGearPanel from "./POGearPanel";
import TicketQueuePanel from "./TicketQueuePanel";
import {
  listRecords,
  getActive,
  getPOs,
  getGearReturns,
  getTickets,
  useDepotOrdersToken,
} from "./depotOrdersApi";

const POLL_INTERVAL_MS = 30000;

export default function DashboardPage() {
  const getToken = useDepotOrdersToken();
  const containerRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await listRecords(token);
      setRecords(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    }
  }, [getToken]);

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
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  const active = getActive(records);

  return (
    <div ref={containerRef} className="h-screen overflow-hidden bg-pink-100 px-4 tv:px-10 py-4 tv:py-8 flex flex-col">
      <div className="flex-shrink-0">
        {!isFullscreen && <BackLink />}
        <div className="flex items-center justify-between mb-4 tv:mb-8">
          <div>
            <h1 className="text-2xl tv:text-6xl font-bold leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
                Depot Dashboard
              </span>
            </h1>
            {lastUpdated && (
              <p className="flex items-center gap-2 text-xs tv:text-lg text-gray-500 mt-1 tv:mt-2">
                <span className="relative flex h-2 w-2 tv:h-3 tv:w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 tv:h-3 tv:w-3 bg-pink-500" />
                </span>
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 tv:px-5 tv:py-2.5 tv:text-lg text-sm font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0"
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 tv:gap-8">
        <POGearPanel pos={getPOs(active)} gearReturns={getGearReturns(active)} />
        <TicketQueuePanel tickets={getTickets(active)} />
      </div>
    </div>
  );
}