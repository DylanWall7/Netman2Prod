import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { listNetboxSites, listNetboxDevicesForSite, useNetworkSearchToken } from "./deviceOutputsApi";
import DeviceOutputsModal from "./DeviceOutputsModal";
import NetworkSearchBackLink from "./NetworkSearchBackLink";

function SiteAutocomplete({ sites, selectedSite, onSelect, isLoading }) {
  return (
    <div className="dark text-foreground flex justify-center">
      <Autocomplete
        size="sm"
        label="Site"
        menuTrigger="input"
        placeholder="Search sites…"
        className="w-72 text-pink-400"
        variant="bordered"
        isLoading={isLoading}
        selectedKey={selectedSite ? String(selectedSite.id) : null}
        onSelectionChange={(key) => {
          const site = sites.find((s) => String(s.id) === key);
          if (site) onSelect(site);
        }}
      >
        {sites.map((site) => (
          <AutocompleteItem key={String(site.id)} value={String(site.id)}>
            {site.name}
          </AutocompleteItem>
        ))}
      </Autocomplete>
    </div>
  );
}

export default function DeviceOutputsBySite() {
  const getToken = useNetworkSearchToken();
  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSite, setSelectedSite] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [activeNetboxId, setActiveNetboxId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingSites(true);
      setError(null);
      try {
        const token = await getToken();
        const data = await listNetboxSites(token);
        if (!cancelled) setSites(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load sites");
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSite = async (site) => {
    setSelectedSite(site);
    setDevices([]);
    setLoadingDevices(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await listNetboxDevicesForSite(site.id, token);
      setDevices(data);
    } catch (err) {
      setError(err.message || "Failed to load devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 space-y-5">
      <NetworkSearchBackLink />
      <div className="text-center mb-2">
        <h1 className="inline-block text-3xl font-bold leading-tight mb-2 pb-4 relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            Device Outputs by Site
          </span>
          <span className="absolute bottom-0 left-0 w-full h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-gray-500">Pick a site to see its devices, then click one to view its outputs.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">{error}</div>
      )}

      <SiteAutocomplete
        sites={sites}
        selectedSite={selectedSite}
        onSelect={handleSelectSite}
        isLoading={loadingSites}
      />

      {loadingDevices ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-blue-300">
          <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          Loading devices…
        </div>
      ) : selectedSite && devices.length === 0 ? (
        <p className="text-sm text-gray-600 italic">No devices found for {selectedSite.name}.</p>
      ) : devices.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900 text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {devices.map((device) => (
                <tr
                  key={device.id}
                  onClick={() => setActiveNetboxId(device.id)}
                  className="cursor-pointer hover:bg-gray-800/60 text-gray-200"
                >
                  <td className="px-4 py-2.5 font-medium">{device.name || `#${device.id}`}</td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {device.role?.name || device.device_role?.name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {device.device_type?.model || device.device_type?.display || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{device.status?.label || device.status?.value || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeNetboxId && (
        <DeviceOutputsModal netboxId={activeNetboxId} onClose={() => setActiveNetboxId(null)} />
      )}
    </div>
  );
}
