import { Fragment, useEffect, useRef, useState } from "react";
import { GizmoRequest } from "../../authConfig";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";

import { Button, Autocomplete, AutocompleteItem, Checkbox, Select, SelectItem } from "@nextui-org/react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import { ServerStackIcon } from "@heroicons/react/24/outline";
import { useMsal } from "@azure/msal-react";
import Badge from "../DepotOrders/Badge";
import AddDevicesModal from "./AddDevicesModal";
import { getMistDevices } from "../SiteDashboard/siteDashboardApi";

export const ManageDevicePage = () => {
  const { instance, accounts, inProgress } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  const [isLoading, setIsLoading] = useState(false);
  const [netboxLoading, setNetboxLoading] = useState(false);
  const [siteList, setSiteList] = useState([]);
  const [siteCodeSelected, setSiteCodeSelected] = useState("");
  const [getDeviceData, setGetDeviceData] = useState([]);
  const [searchTerms, setSearchTerms] = useState({});
  const [siteLoadError, setSiteLoadError] = useState(null);
  const [deviceLoadError, setDeviceLoadError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const copiedTimeoutRef = useRef(null);
  const [showAddDevicesModal, setShowAddDevicesModal] = useState(false);
  const [mistLiveBySite, setMistLiveBySite] = useState({});
  const [selectedMistKeys, setSelectedMistKeys] = useState(() => new Set());
  const [mistPushStatus, setMistPushStatus] = useState({});
  const [mistPushRunning, setMistPushRunning] = useState(false);
  const [deviceProfiles, setDeviceProfiles] = useState([]);
  const [deviceProfilesLoading, setDeviceProfilesLoading] = useState(false);
  const [deviceProfilesError, setDeviceProfilesError] = useState(null);
  const [deviceProfileSelections, setDeviceProfileSelections] = useState({});
  const [mistPushLog, setMistPushLog] = useState({});
  const [mistPushLogStatus, setMistPushLogStatus] = useState({});
  const [mistLogFilter, setMistLogFilter] = useState({});
  const [mistLogsCopied, setMistLogsCopied] = useState({});

  const url = `https://${process.env.REACT_APP_API_BASEURL}/api/management/netbox/sites/`;
  const GetDevicesURL = `https://${process.env.REACT_APP_API_BASEURL}/api/management/netbox/${siteCodeSelected}/devices/`;
  const DeviceProfilesURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/mist/deviceprofiles`;

  // AP12 is the RAP hardware model — only these need a device profile to push.
  const isRapDevice = (device) => {
    const model = device.device_type?.model || device.device_type?.display || "";
    return model.toUpperCase().includes("AP12");
  };

  const getMistDeviceKey = (siteIndex, device) =>
    `${siteIndex}-${device.serial || device.name || device.id}`;

  async function GetAllSites({ token }) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
      const text = await res.json();
      setSiteList(text);
    } catch (error) {
      setSiteLoadError(error.message || "Failed to load sites — please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function getAccessToken(instance, request) {
    try {
      const response = await instance.acquireTokenSilent(request);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Full-page redirect, not a popup — a popup would just reload the whole SPA inside itself.
        await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
        return null;
      }
      throw error;
    }
  }

  // Guards against a re-render mid-redirect firing ssoSilent/loginRedirect twice.
  const ssoAttempted = useRef(false);
  useEffect(() => {
    if (ssoAttempted.current) return;
    if (inProgress === InteractionStatus.None && accounts.length === 0) {
      ssoAttempted.current = true;
      instance.ssoSilent(request).catch(() => {
        instance.loginRedirect({ ...request, redirectStartPage: window.location.href });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts, instance]);

  useEffect(() => {
    // No account yet — wait rather than race the sign-in flow above.
    if (accounts.length === 0) return;
    (async () => {
      setIsLoading(true);
      setSiteLoadError(null);
      try {
        const token = await getAccessToken(instance, request);
        if (token) await GetAllSites({ token });
        else setIsLoading(false); // falling back to a redirect — page is about to navigate away
      } catch (err) {
        setSiteLoadError(err.message || "Failed to load sites — please try again.");
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  async function loadDeviceProfiles() {
    setDeviceProfilesLoading(true);
    setDeviceProfilesError(null);
    try {
      const token = await getAccessToken(instance, request);
      const res = await fetch(DeviceProfilesURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Failed to load device profiles (${res.status})`);
      const response = await res.json();
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setDeviceProfiles(list);
    } catch (err) {
      setDeviceProfilesError(err.message || "Failed to load device profiles.");
    } finally {
      setDeviceProfilesLoading(false);
    }
  }

  useEffect(() => {
    if (accounts.length === 0) return;
    loadDeviceProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const pushDeviceToMist = async (device, key, siteCode, mistSiteId, mobType) => {
    setMistPushStatus((prev) => ({ ...prev, [key]: "pending" }));

    const body = isRapDevice(device)
      ? {
          name: device.name,
          serial: device.serial,
          deviceprofile_id: deviceProfileSelections[key],
        }
      : {
          site_code: siteCode,
          mist_site_id: mistSiteId ?? null,
          mob_type: mobType,
          name: device.name,
          serial: device.serial,
        };

    const label = device.name || device.serial || "Device";
    try {
      const token = await getAccessToken(instance, request);
      const response = await fetch(
        `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/mist/site/${siteCode}/device`,
        {
          method: "POST",
          body: JSON.stringify([body]),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error(`Push to Mist failed (${response.status})`);
      const data = await response.json();
      const log = data?.log?.length ? data.log : [{ msg: `${label}: pushed to Mist.`, status: 1 }];
      const status = data?.status ?? (log.some((m) => m.status === 0) ? 0 : 1);
      setMistPushStatus((prev) => ({ ...prev, [key]: status === 0 ? "failed" : "done" }));
      return { status, log };
    } catch (err) {
      setMistPushStatus((prev) => ({ ...prev, [key]: "failed" }));
      return { status: 0, log: [{ msg: `${label}: ${err.message || "Push to Mist failed."}`, status: 0 }] };
    }
  };

  const toggleMistDeviceSelected = (key) => {
    setSelectedMistKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGetDevices = async () => {
    setNetboxLoading(true);
    setGetDeviceData([]);
    setMistLiveBySite({});
    setSelectedMistKeys(new Set());
    setMistPushStatus({});
    setDeviceProfileSelections({});
    setMistPushLog({});
    setMistPushLogStatus({});
    setMistLogFilter({});
    setMistLogsCopied({});
    try {
      const token = await getAccessToken(instance, request);
      const res = await fetch(GetDevicesURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const response = await res.json();

      const dataArray = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setGetDeviceData(dataArray);

      // Netbox's custom.mistdevice fields lag — the live Mist devicesummary list is authoritative.
      const entries = await Promise.all(
        dataArray.map(async (siteItem) => {
          const mistId = siteItem?.data?.mistsite?.id;
          if (!mistId) return null;
          try {
            const liveList = await getMistDevices(mistId, token);
            return [mistId, liveList];
          } catch {
            return [mistId, []];
          }
        })
      );
      setMistLiveBySite(Object.fromEntries(entries.filter(Boolean)));
    } catch (err) {
      setDeviceLoadError(err.message || "Failed to load devices — please try again.");
    } finally {
      setNetboxLoading(false);
    }
  };
  function copyToClipboard(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <>
      <div className="text-pink-400 flex flex-col items-center pb-20">
        <div className="max-w-3xl text-center mt-16">
          <h1 className="text-3xl font-bold leading-tight mb-2 text-pink-400">
            Netbox Device Manager
          </h1>
          <p className="text-sm text-pink-200/60 mb-8">
            Search, review, and add devices in Netbox.
          </p>
        </div>

        <form className="w-full flex justify-center items-end gap-2 mb-10">
          <div className="dark text-foreground">
            <Autocomplete
              size="sm"
              label="Site Code (From Netbox)"
              menuTrigger="input"
              placeholder="Site Code"
              className="max-w-sm text-pink-400"
              variant="bordered"
              isLoading={isLoading}
              onSelectionChange={(key) => {
                setSiteCodeSelected(key ?? "");
                setDeviceLoadError(null);
              }}
              onInputChange={(value) => {
                if (!value) setSiteCodeSelected("");
              }}
            >
              {siteList?.map((site) => (
                <AutocompleteItem key={site.name} value={site.name}>
                  {site.name || "No Site Code"}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>

          <Button
            size="sm"
            isLoading={netboxLoading}
            isDisabled={!siteCodeSelected}
            onPress={handleGetDevices}
            className="bg-pink-600 text-black font-semibold hover:bg-pink-500 transition-colors"
          >
            Search Devices
          </Button>
        </form>

        {siteLoadError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm max-w-xl text-center">
            {siteLoadError}
          </div>
        )}

        {deviceLoadError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm max-w-xl text-center">
            {deviceLoadError}
          </div>
        )}

        <div className="w-full max-w-6xl space-y-8">
          {netboxLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div
                className="h-8 w-8 rounded-full border-2 border-pink-200/20 border-t-pink-500 animate-spin"
                role="status"
                aria-label="Loading devices"
              />
              <p className="text-pink-200/60 text-sm">Loading devices…</p>
            </div>
          )}

          {(!getDeviceData || getDeviceData.length === 0) && !netboxLoading && !deviceLoadError && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-pink-700 border border-pink-200/20 flex items-center justify-center">
                <ServerStackIcon className="w-8 h-8 text-pink-200/50" />
              </div>

              <p className="text-pink-200/60 text-sm max-w-sm">
                Looks like no site is selected — choose one to start managing
                devices.
              </p>
            </div>
          )}

          {getDeviceData.map((siteItem, index) => {
            const site = siteItem.data?.netboxsite;
            const mist = siteItem.data?.mistsite;
            const devices = siteItem.data?.devices || [];
            // Name is the merge key — same one the Site Dashboard and Prov tool use.
            const liveMistNames = new Set(
              (mistLiveBySite[mist?.id] || [])
                .map((d) => (d.name || "").trim().toLowerCase())
                .filter(Boolean)
            );
            const siteCode = site?.name || siteCodeSelected;
            const mobType = site?.custom_fields?.MOB_TYPE;

            const filteredDevices = devices.filter((device) =>
              device.name?.toLowerCase().includes((searchTerms[index] || "").toLowerCase())
            );
            const notInMistDevices = filteredDevices.filter(
              (device) => !liveMistNames.has((device.name || "").trim().toLowerCase())
            );
            const notInMistKeys = new Set(notInMistDevices.map((d) => getMistDeviceKey(index, d)));
            const selectedInThisSite = [...selectedMistKeys].filter((k) => notInMistKeys.has(k));
            const allSelected = notInMistKeys.size > 0 && selectedInThisSite.length === notInMistKeys.size;
            const someSelected = selectedInThisSite.length > 0 && !allSelected;
            const missingRequiredProfile = notInMistDevices.some((device) => {
              const key = getMistDeviceKey(index, device);
              if (!selectedMistKeys.has(key)) return false;
              return isRapDevice(device) && !deviceProfileSelections[key];
            });

            const toggleSelectAllForSite = () => {
              setSelectedMistKeys((prev) => {
                const next = new Set(prev);
                if (allSelected) {
                  notInMistKeys.forEach((k) => next.delete(k));
                } else {
                  notInMistKeys.forEach((k) => next.add(k));
                }
                return next;
              });
            };

            const handlePushThisSite = async () => {
              const targets = notInMistDevices
                .map((device) => ({ device, key: getMistDeviceKey(index, device) }))
                .filter(({ key }) => selectedMistKeys.has(key));
              if (targets.length === 0) return;
              setMistPushRunning(true);
              const results = await Promise.all(
                targets.map(({ device, key }) => pushDeviceToMist(device, key, siteCode, mist?.id, mobType))
              );
              setMistPushRunning(false);

              const overallStatus = results.some((r) => r.status === 0) ? 0 : 1;
              const allLogs = results.flatMap((r) => r.log);
              setMistPushLog((prev) => ({ ...prev, [index]: allLogs }));
              setMistPushLogStatus((prev) => ({ ...prev, [index]: overallStatus }));
              setMistLogFilter((prev) => ({ ...prev, [index]: null }));
            };

            const handleRetryMistPushForSite = async (device, key) => {
              const result = await pushDeviceToMist(device, key, siteCode, mist?.id, mobType);
              setMistPushLog((prev) => ({ ...prev, [index]: result.log }));
              setMistPushLogStatus((prev) => ({ ...prev, [index]: result.status }));
              setMistLogFilter((prev) => ({ ...prev, [index]: null }));
            };

            return (
              <Fragment key={index}>
              <div
                className="bg-pink-700 border border-pink-200/20 rounded-xl p-6"
              >
                {/* Site Info */}
                <div className="mb-4 border-b border-pink-200/15 pb-3 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-semibold text-pink-400">
                      {site?.display || "Unknown Site"}
                    </h2>
                  </div>
                  <div>
                    {mist ? (
                      <Badge color="green">Mist site found</Badge>
                    ) : (
                      <Badge color="red">Mist site not found</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="w-full max-w-md">
                    <label htmlFor={`device-search-${index}`} className="sr-only">
                      Search devices by name
                    </label>
                    <input
                      id={`device-search-${index}`}
                      type="text"
                      placeholder="Search devices by name..."
                      value={searchTerms[index] || ""}
                      onChange={(e) =>
                        setSearchTerms((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg bg-[#081b2a] border border-pink-200/20 text-pink-400 placeholder:text-pink-200/40 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => setShowAddDevicesModal(true)}
                    className="border-pink-500 text-pink-500 hover:bg-pink-500/10 flex-shrink-0"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add Devices to Netbox
                  </Button>
                </div>

                {notInMistDevices.length > 0 && (
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <Checkbox
                      size="sm"
                      isSelected={allSelected}
                      isIndeterminate={someSelected}
                      onValueChange={toggleSelectAllForSite}
                      classNames={{ label: "text-pink-200 text-xs" }}
                    >
                      Select All Not in Mist
                    </Checkbox>
                    <Button
                      size="sm"
                      isLoading={mistPushRunning}
                      isDisabled={selectedInThisSite.length === 0 || missingRequiredProfile}
                      onPress={handlePushThisSite}
                      className="bg-pink-600"
                    >
                      {selectedInThisSite.length === 1 ? "Push Device to Mist" : "Push Devices to Mist"}
                    </Button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-pink-200/10">
                    <thead className="bg-pink-300/40 text-pink-200/70 text-left text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold w-10"></th>
                        <th className="px-4 py-2.5 font-semibold">Device Name</th>
                        <th className="px-4 py-2.5 font-semibold">IP Address</th>
                        <th className="px-4 py-2.5 font-semibold">Model</th>
                        <th className="px-4 py-2.5 font-semibold">Serial</th>
                        <th className="px-4 py-2.5 font-semibold">Polling</th>
                        <th className="px-4 py-2.5 font-semibold">Alert</th>

                        <th className="px-4 py-2.5 font-semibold text-center">
                          Mist Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-200/10 text-sm">
                      {filteredDevices.length > 0 ? (
                        filteredDevices
                          .map((device, idx) => {
                            const inMist = liveMistNames.has(
                              (device.name || "").trim().toLowerCase()
                            );
                            const key = getMistDeviceKey(index, device);
                            const pushStatus = mistPushStatus[key];
                            const effectivelyInMist = inMist || pushStatus === "done";
                            const needsProfile = !effectivelyInMist && isRapDevice(device);
                            // Null mistdevicesite means "not in Mist yet," not "wrong site."
                            const wrongSite =
                              !inMist &&
                              !!device.custom?.mistdevicesite &&
                              device.custom?.mistdevicesite !== mist?.id &&
                              device.device_type?.manufacturer?.name ===
                                "Juniper";

                            return (
                              <Fragment key={key}>
                                <tr
                                  className="hover:bg-pink-300/10 transition-colors duration-150"
                                >
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    size="sm"
                                    isSelected={selectedMistKeys.has(key)}
                                    isDisabled={effectivelyInMist || mistPushRunning}
                                    onValueChange={() => toggleMistDeviceSelected(key)}
                                  />
                                </td>
                                <td className="px-4 py-3 font-medium">
                                  {device.name}
                                </td>
                                <td className="px-4 py-3 font-medium">
                                  {device.custom_fields?.ip || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {device.device_type?.display || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {wrongSite ? (
                                    <div>
                                      <div className="relative group inline-flex items-center gap-1.5">
                                        <ExclamationTriangleIcon
                                          className="w-4 h-4 text-yellow-400 flex-shrink-0"
                                          aria-hidden="true"
                                        />
                                        <span
                                          tabIndex={0}
                                          aria-describedby={`wrong-site-tip-${index}-${idx}`}
                                          className="text-yellow-400 cursor-pointer pr-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                                        >
                                          {device.serial || "—"}
                                        </span>

                                        <div
                                          id={`wrong-site-tip-${index}-${idx}`}
                                          role="tooltip"
                                          className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-max rounded-md bg-pink-300 text-yellow-400 text-md px-3 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 shadow-lg border border-pink-200/20"
                                        >
                                          <span>
                                            Device is assigned to the wrong
                                            site in Mist!
                                          </span>
                                        </div>
                                      </div>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        isDisabled={!device.serial}
                                        aria-label="Copy serial number"
                                        onPress={() =>
                                          copyToClipboard(device.serial, `${index}-${idx}`)
                                        }
                                        className="bg-pink-300 text-pink-400"
                                      >
                                        {copiedKey === `${index}-${idx}` ? (
                                          <CheckIcon className="w-4 h-4 text-green-400" />
                                        ) : (
                                          <ClipboardIcon className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="pr-3">
                                        {device.serial || "—"}
                                      </span>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        isDisabled={!device.serial}
                                        aria-label="Copy serial number"
                                        onPress={() =>
                                          copyToClipboard(device.serial, `${index}-${idx}`)
                                        }
                                        className="bg-pink-300 text-pink-400"
                                      >
                                        {copiedKey === `${index}-${idx}` ? (
                                          <CheckIcon className="w-4 h-4 text-green-400" />
                                        ) : (
                                          <ClipboardIcon className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {device.custom_fields?.POLLING === true ? (
                                    <Badge color="green">Enabled</Badge>
                                  ) : device.custom_fields?.POLLING === false ? (
                                    <Badge color="gray">Disabled</Badge>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {device.custom_fields?.ALERT === true ? (
                                    <Badge color="green">Enabled</Badge>
                                  ) : device.custom_fields?.ALERT === false ? (
                                    <Badge color="gray">Disabled</Badge>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {pushStatus === "pending" ? (
                                    <div
                                      className="w-4 h-4 rounded-full border-2 border-pink-400/40 border-t-pink-400 animate-spin mx-auto"
                                      title="Pushing…"
                                    />
                                  ) : effectivelyInMist ? (
                                    <CheckCircleIcon
                                      className="h-6 w-6 text-green-500 mx-auto"
                                      role="img"
                                      aria-label="In Mist"
                                    />
                                  ) : pushStatus === "failed" ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <XCircleIcon
                                        className="h-6 w-6 text-red-500"
                                        role="img"
                                        aria-label="Push failed"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRetryMistPushForSite(device, key)}
                                        title="Retry push to Mist"
                                        className="appearance-none bg-transparent border-0 p-0 text-pink-400 hover:text-pink-500 transition-colors text-sm leading-none"
                                      >
                                        ↻
                                      </button>
                                    </div>
                                  ) : (
                                    <XCircleIcon
                                      className="h-6 w-6 text-red-500 mx-auto"
                                      role="img"
                                      aria-label="Not in Mist"
                                    />
                                  )}
                                </td>
                                </tr>
                                {needsProfile && (
                                  <tr className="bg-pink-300/10">
                                    <td />
                                    <td colSpan={7} className="px-4 pb-3 -mt-1">
                                      {deviceProfilesLoading ? (
                                        <div className="h-8 bg-pink-300/40 rounded animate-pulse w-full max-w-md" />
                                      ) : deviceProfilesError ? (
                                        <div>
                                          <p className="text-xs text-red-400">{deviceProfilesError}</p>
                                          <button
                                            onClick={loadDeviceProfiles}
                                            className="text-xs font-semibold text-red-300 underline hover:text-red-100 transition-colors"
                                          >
                                            Try again
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="dark text-foreground">
                                          <Select
                                            size="sm"
                                            isRequired
                                            label="Device Profile (AP12)"
                                            placeholder="Select a device profile"
                                            selectedKeys={
                                              deviceProfileSelections[key] ? [deviceProfileSelections[key]] : []
                                            }
                                            onSelectionChange={(keys) =>
                                              setDeviceProfileSelections((prev) => ({
                                                ...prev,
                                                [key]: [...keys][0] || "",
                                              }))
                                            }
                                            isDisabled={mistPushRunning}
                                            className="max-w-md w-full text-pink-400"
                                            variant="bordered"
                                          >
                                            {deviceProfiles.map((profile) => (
                                              <SelectItem key={profile.id}>{profile.name}</SelectItem>
                                            ))}
                                          </Select>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })
                      ) : (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-4 py-6 text-center text-pink-200/50 italic"
                          >
                            No devices found for this site.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

                {mistPushLog[index] && mistPushLog[index].length > 0 && (
                  <div className="max-w-2xl mx-auto mt-4">
                    <div
                      className={`flex items-center justify-between px-3 py-2 bg-[#0d2438] rounded-t-lg border ${
                        mistPushLogStatus[index] === 0
                          ? "border-red-500/50"
                          : mistPushLogStatus[index] === 1
                          ? "border-green-500/50"
                          : "border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Push to Mist Results
                        </span>
                        <button
                          onClick={() =>
                            setMistLogFilter((prev) => ({ ...prev, [index]: prev[index] === 1 ? null : 1 }))
                          }
                          className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                            mistLogFilter[index] === 1
                              ? "bg-green-600 text-white"
                              : "bg-green-900/40 text-green-400 hover:bg-green-800/60"
                          }`}
                        >
                          ✓ {mistPushLog[index].filter((m) => m.status !== 0).length}
                        </button>
                        <button
                          onClick={() =>
                            setMistLogFilter((prev) => ({ ...prev, [index]: prev[index] === 0 ? null : 0 }))
                          }
                          className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                            mistLogFilter[index] === 0
                              ? "bg-red-600 text-white"
                              : "bg-red-900/40 text-red-400 hover:bg-red-800/60"
                          }`}
                        >
                          ✗ {mistPushLog[index].filter((m) => m.status === 0).length}
                        </button>
                        {mistLogFilter[index] != null && (
                          <button
                            onClick={() => setMistLogFilter((prev) => ({ ...prev, [index]: null }))}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            show all
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const text = mistPushLog[index]
                            .filter((m) => mistLogFilter[index] == null || m.status === mistLogFilter[index])
                            .map((m) => `[${m.status === 0 ? "ERR" : " OK"}] ${m.msg}`)
                            .join("\n");
                          navigator.clipboard.writeText(text);
                          setMistLogsCopied((prev) => ({ ...prev, [index]: true }));
                          setTimeout(() => setMistLogsCopied((prev) => ({ ...prev, [index]: false })), 2000);
                        }}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          mistLogsCopied[index] ? "bg-green-700 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                        }`}
                      >
                        {mistLogsCopied[index] ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div
                      className={`overflow-y-auto max-h-[320px] bg-[#081b2a] border border-t-0 rounded-b-lg ${
                        mistPushLogStatus[index] === 0
                          ? "border-red-500/50"
                          : mistPushLogStatus[index] === 1
                          ? "border-green-500/50"
                          : "border-white/10"
                      }`}
                    >
                      {mistPushLog[index]
                        .filter((m) => mistLogFilter[index] == null || m.status === mistLogFilter[index])
                        .map((message, msgIdx) => (
                          <div
                            key={msgIdx}
                            className={`flex items-start gap-2 px-3 py-1.5 border-b border-white/5 text-xs font-mono last:border-0 ${
                              message.status === 0 ? "text-red-300" : "text-green-300"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex-shrink-0 font-bold ${
                                message.status === 0 ? "text-red-500" : "text-green-500"
                              }`}
                            >
                              {message.status === 0 ? "✗" : "✓"}
                            </span>
                            <span>{message.msg}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {showAddDevicesModal && (
        <AddDevicesModal
          siteCode={siteCodeSelected}
          onClose={() => setShowAddDevicesModal(false)}
          onDeployed={handleGetDevices}
        />
      )}
    </>
  );
};
