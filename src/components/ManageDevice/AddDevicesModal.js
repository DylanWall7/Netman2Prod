import React, { useEffect, useRef, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { Autocomplete, AutocompleteItem, Button } from "@nextui-org/react";
import { GizmoRequest } from "../../authConfig";

// Ported from ProvStepper's "Deploy Devices to Netbox" step as its own copy, not a shared import.

const RedMinusIcon = ({ size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="red"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="cursor-pointer hover:scale-110 transition-transform duration-200"
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);

const GreenPlusIcon = ({ fill = "currentColor", size = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 24 24"
    stroke={fill}
    className="transition-colors"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M3 12h18" />
  </svg>
);

function incrementName(name, offset) {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) return name;
  const [, prefix, numStr] = match;
  const next = (parseInt(numStr, 10) + offset).toString().padStart(numStr.length, "0");
  return prefix + next;
}

const EMPTY_DEVICE = { serial: "", name: "", model: "", ip: "", oob_ip: "" };

export default function AddDevicesModal({ siteCode, onClose, onDeployed }) {
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };

  const getToken = async () => {
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Full-page redirect, not a popup — a popup would just reload the whole SPA inside itself.
        await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
        return null;
      }
      throw error;
    }
  };

  const ModelURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netbox/devicetypes`;
  const DeployDeviceURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCode}/devices`;

  const [modelList, setModelList] = useState([]);
  const [devices, setDevices] = useState([{ ...EMPTY_DEVICE }]);
  const [deviceDeployStatus, setDeviceDeployStatus] = useState([]);
  const [csvLimitWarning, setCsvLimitWarning] = useState(false);
  const [dragState, setDragState] = useState({ active: false, field: null, fromIndex: null, toIndex: null });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const [availableIps, setAvailableIps] = useState([]);
  const [nextIpLoading, setNextIpLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [resultLog, setResultLog] = useState([]);
  const [resultStatus, setResultStatus] = useState(null);
  const [logFilter, setLogFilter] = useState(null);
  const [logsCopied, setLogsCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(ModelURL, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Failed to load device types (${res.status})`);
        setModelList(await res.json());
      } catch {
        // Non-critical — the model dropdown just has no options if this fails.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (index, event) => {
    const values = [...devices];
    values[index][event.target.name] = event.target.value;
    setDevices(values);
  };

  const handleAddDevice = () => {
    if (devices?.length >= 500) return;
    setDevices([...devices, { ...EMPTY_DEVICE }]);
  };

  const handleRemoveDevice = (index) => {
    setDevices((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ ...EMPTY_DEVICE }];
    });
  };

  const handleDownloadTemplate = () => {
    const rows = [
      "serial,name,model,ip,oob_ip",
      "AJ123456789,KHONELABWAP0101,AP43,,",
      "AJ123456790,KHONELABWAP0102,AP43,,",
      "AJ123456791,KHONELABSW0101,EX3400-48P,10.0.0.1,",
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "device_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (event) => {
    setDevices([]);
    setCsvLimitWarning(false);
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split("\n").map((row) => row.trim()).filter(Boolean);
      const [header, ...lines] = rows;
      const headers = header.split(",").map((h) => h.trim());

      const parsedDevices = lines.map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const device = {};
        headers.forEach((h, i) => {
          device[h] = values[i] || "";
        });
        return device;
      });

      const limitedDevices = parsedDevices.slice(0, 500);
      if (parsedDevices.length > 500) setCsvLimitWarning(true);

      setDevices((prev) => [...prev, ...limitedDevices]);
    };
    reader.readAsText(file);
  };

  const handleGetAvailableIps = async () => {
    if (availableIps && availableIps.length > 0) return { status: 1, data: { switches: availableIps, routers: [] } };
    setNextIpLoading(true);
    try {
      const token = await getToken();
      if (!token) return { status: 0, log: [], data: { routers: [], switches: [] } };
      const nextIPURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCode}/addresses/${devices?.length}`;
      const res = await fetch(nextIPURL, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAvailableIps(data?.data?.switches || []);
      return data;
    } catch {
      return { status: 0, log: [{ msg: "Failed to fetch available IPs", status: 0 }], data: { routers: [], switches: [] } };
    } finally {
      setNextIpLoading(false);
    }
  };

  const handleFillIPs = async () => {
    const response = await handleGetAvailableIps();
    if (response?.status === 0) {
      setResultLog(response?.log || []);
      setResultStatus(0);
      return;
    }
    const ipData = response?.data;

    setDevices((prevDevices) => {
      const usedIps = prevDevices.map((d) => d.ip).filter(Boolean);
      let routerIps = ipData?.routers?.filter((ip) => !usedIps.includes(ip)) || [];
      let switchIps = ipData?.switches?.filter((ip) => !usedIps.includes(ip)) || [];

      const updated = prevDevices.map((device) => {
        if (!device.ip) {
          if (device.model?.startsWith("SRX")) {
            const ip = routerIps.shift();
            return ip ? { ...device, ip } : device;
          }
          if (
            (/^.*_0$/.test(device.name ?? "") || !/_\d+$/.test(device.name ?? "")) &&
            !device.model?.startsWith("AP")
          ) {
            const ip = switchIps.shift();
            return ip ? { ...device, ip } : device;
          }
        }
        return device;
      });

      setAvailableIps(switchIps);
      return updated;
    });
  };

  const handleClearIPs = () => {
    setDevices((prevDevices) => prevDevices.map((d) => ({ ...d, ip: "", oob_ip: "" })));
    setAvailableIps([]);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      const ds = dragStateRef.current;
      if (!ds.active) return;
      if (ds.fromIndex !== null && ds.toIndex !== null && ds.fromIndex !== ds.toIndex) {
        const { field, fromIndex, toIndex } = ds;
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        setDevices((prev) => {
          const updated = [...prev];
          const sourceValue = updated[fromIndex]?.[field] ?? "";
          const existingEnd = Math.min(end, prev.length - 1);
          const newRowCount = Math.min(Math.max(0, end - (prev.length - 1)), 500 - prev.length);
          for (let i = start; i <= existingEnd; i++) {
            if (i === fromIndex) continue;
            if (field === "name") {
              updated[i] = { ...updated[i], name: incrementName(sourceValue, i - fromIndex) };
            } else {
              updated[i] = { ...updated[i], [field]: sourceValue };
            }
          }
          for (let i = 0; i < newRowCount; i++) {
            const offset = prev.length + i - fromIndex;
            const newRow = { ...EMPTY_DEVICE };
            if (field === "name") {
              newRow.name = incrementName(sourceValue, offset);
            } else {
              newRow[field] = sourceValue;
            }
            updated.push(newRow);
          }
          return updated;
        });
      }
      setDragState({ active: false, field: null, fromIndex: null, toIndex: null });
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const hasACM = devices.some((d) => d.model?.startsWith("ACM"));
  const hasDeployStatus = deviceDeployStatus.length > 0;
  const gridColsTemplate = hasACM
    ? hasDeployStatus
      ? "2rem 1.5fr 1.5fr 1.5fr 1fr 1fr 5.5rem 5.5rem"
      : "2rem 1.5fr 1.5fr 1.5fr 1fr 1fr 5.5rem"
    : hasDeployStatus
    ? "2rem 1.5fr 1.5fr 1.5fr 1fr 5.5rem 5.5rem"
    : "2rem 1.5fr 1.5fr 1.5fr 1fr 5.5rem";

  // One request per device, concurrent — each updates status as soon as it lands.
  const handleDeploy = async () => {
    setDeployLoading(true);
    setResultStatus(null);
    setResultLog([]);
    setDeviceDeployStatus(devices.map((d) => ({ serial: d.serial, name: d.name, status: "pending" })));

    const token = await getToken();
    if (!token) {
      setDeployLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const results = await Promise.all(
      devices.map(async (device, index) => {
        try {
          const response = await fetch(DeployDeviceURL, {
            method: "POST",
            body: JSON.stringify([device]),
            headers,
          });
          if (!response.ok) throw new Error(`Deploy devices failed (${response.status})`);
          const data = await response.json();
          const log = data?.log || [];
          const status = data?.status ?? (log.some((m) => m.status === 0) ? 0 : 1);
          setDeviceDeployStatus((prev) => prev.map((d, i) => (i === index ? { ...d, status } : d)));
          return { status, log };
        } catch (err) {
          const label = device.name || device.serial || `Device ${index + 1}`;
          const log = [{ msg: `${label}: ${err.message || "Deploy failed."}`, status: 0 }];
          setDeviceDeployStatus((prev) => prev.map((d, i) => (i === index ? { ...d, status: 0 } : d)));
          return { status: 0, log };
        }
      })
    );

    const allLogs = results.flatMap((r) => r.log);
    const overallStatus = results.some((r) => r.status === 0) ? 0 : 1;
    setResultLog(allLogs);
    setResultStatus(overallStatus);
    setDeployLoading(false);
    onDeployed?.();
  };

  // Re-sends only the failed device, not the whole batch.
  const handleRedeployDevice = async (index) => {
    const device = devices[index];
    if (!device) return;
    setDeviceDeployStatus((prev) => prev.map((d, i) => (i === index ? { ...d, status: "pending" } : d)));
    const label = device.name || device.serial || `Device ${index + 1}`;
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(DeployDeviceURL, {
        method: "POST",
        body: JSON.stringify([device]),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`Deploy devices failed (${response.status})`);
      const data = await response.json();
      const log = data?.log || [];
      const status = data?.status ?? (log.some((m) => m.status === 0) ? 0 : 1);
      setDeviceDeployStatus((prev) => prev.map((d, i) => (i === index ? { ...d, status } : d)));
      setResultLog((prev) => [...(Array.isArray(prev) ? prev : []), ...log]);
      onDeployed?.();
    } catch (err) {
      const entry = { msg: `${label}: ${err.message || "Deploy failed."}`, status: 0 };
      setDeviceDeployStatus((prev) => prev.map((d, i) => (i === index ? { ...d, status: 0 } : d)));
      setResultLog((prev) => [...(Array.isArray(prev) ? prev : []), entry]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-devices-modal-title"
        className="w-full max-w-6xl max-h-full rounded-2xl border border-pink-200/20 bg-pink-700 shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-pink-200/15 flex-shrink-0">
          <div>
            <p className="text-xs font-mono text-pink-200/60 mb-0.5">{siteCode}</p>
            <h2 id="add-devices-modal-title" className="text-lg font-bold text-pink-400">
              Add Devices to Netbox
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-pink-200/60 hover:text-pink-200 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div className="px-2 py-2 flex items-center justify-between">
            <span className="text-xs text-pink-400 tracking-wider uppercase font-medium select-none">
              Device Assign List
            </span>
            <div className="relative group">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-violet-400 hover:text-violet-300 hover:bg-violet-400/10 rounded p-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
              </button>
              <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-pink-300 border border-pink-200/20 text-pink-400 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Download CSV Template
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="overflow-hidden rounded-lg border border-pink-200/20 min-w-[640px]">
              {/* Table header */}
              <div
                className="grid bg-pink-300/40 border-b border-pink-200/20 text-xs uppercase tracking-wider text-pink-200/70 font-semibold select-none"
                style={{ gridTemplateColumns: gridColsTemplate }}
              >
                <div className="flex items-center justify-center py-2 border-r border-pink-200/15">#</div>
                <div className="flex items-center px-2 py-2 border-r border-pink-200/15">Serial</div>
                <div className="flex items-center px-2 py-2 border-r border-pink-200/15">Name</div>
                <div className="flex items-center px-2 py-2 border-r border-pink-200/15">Model</div>
                <div className="flex items-center px-2 py-2 border-r border-pink-200/15">IP</div>
                {hasACM && <div className="flex items-center px-2 py-2 border-r border-pink-200/15">OOB IP</div>}
                {hasDeployStatus && (
                  <div className="flex items-center justify-center px-2 py-2 border-r border-pink-200/15 whitespace-nowrap">
                    Status
                  </div>
                )}
                <div className="flex items-center justify-center px-2 py-2 whitespace-nowrap">Remove</div>
              </div>

              {/* Device rows */}
              {devices.map((device, index) => (
                <div
                  key={index}
                  className={`grid border-b border-pink-200/10 h-10 transition-colors ${
                    dragState.active &&
                    index !== dragState.fromIndex &&
                    index >= Math.min(dragState.fromIndex, Math.min(dragState.toIndex, devices.length - 1)) &&
                    index <= Math.max(dragState.fromIndex, Math.min(dragState.toIndex, devices.length - 1))
                      ? "bg-pink-400/15 ring-1 ring-inset ring-pink-400"
                      : "hover:bg-pink-300/10"
                  }`}
                  style={{ gridTemplateColumns: gridColsTemplate }}
                  onMouseMove={() => {
                    if (dragState.active && dragState.toIndex !== index) {
                      setDragState((prev) => ({ ...prev, toIndex: index }));
                    }
                  }}
                >
                  <div className="flex items-center justify-center text-xs text-pink-200/50 border-r border-pink-200/10 select-none">
                    {index + 1}
                  </div>
                  <div className="relative border-r border-pink-200/10 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                    <input
                      type="text"
                      name="serial"
                      value={device.serial}
                      onChange={(event) => handleInputChange(index, event)}
                      placeholder="Serial Number"
                      className="w-full h-full px-2 bg-transparent text-sm text-pink-400 placeholder:text-pink-200/40 outline-none"
                    />
                  </div>
                  <div className="relative border-r border-pink-200/10 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                    <input
                      type="text"
                      name="name"
                      value={device.name}
                      onChange={(event) => handleInputChange(index, event)}
                      placeholder="Device Name"
                      className="w-full h-full px-2 pr-4 bg-transparent text-sm text-pink-400 placeholder:text-pink-200/40 outline-none"
                    />
                    <div
                      title="Drag down to fill names"
                      className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-pink-500 border border-pink-800 cursor-ns-resize z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDragState({ active: true, field: "name", fromIndex: index, toIndex: index });
                      }}
                    />
                  </div>
                  <div className="dark relative border-r border-pink-200/10">
                    <Autocomplete
                      size="sm"
                      menuTrigger="input"
                      placeholder="Model"
                      variant="flat"
                      selectedKey={device.model}
                      classNames={{
                        base: "max-w-full h-full",
                        mainWrapper: "h-full",
                        inputWrapper: "bg-transparent shadow-none rounded-none border-none h-full min-h-0 py-0 pl-0 pr-6 group-data-[focus=true]:bg-pink-400/5",
                        input: "text-sm text-pink-400 placeholder:text-pink-200/40 pl-2 py-0",
                        innerWrapper: "bg-transparent h-full py-0",
                      }}
                      onSelectionChange={(value) => {
                        const values = [...devices];
                        values[index].model = value;
                        setDevices(values);
                      }}
                    >
                      {modelList.map((model) => (
                        <AutocompleteItem key={model} value={model}>
                          {model ? model : "No Model"}
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>
                    <div
                      title="Drag down to fill model"
                      className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-pink-500 border border-pink-800 cursor-ns-resize z-10"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDragState({ active: true, field: "model", fromIndex: index, toIndex: index });
                      }}
                    />
                  </div>
                  <div className="relative border-r border-pink-200/10 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                    <input
                      type="text"
                      name="ip"
                      value={device.ip}
                      disabled={device.model?.startsWith("AP")}
                      onChange={(event) => handleInputChange(index, event)}
                      placeholder="IP Address"
                      className="w-full h-full px-2 bg-transparent text-sm text-pink-400 placeholder:text-pink-200/40 outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>
                  {hasACM && (
                    <div className="relative border-r border-pink-200/10 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                      {device.model?.startsWith("ACM") && (
                        <input
                          type="text"
                          name="oob_ip"
                          value={device.oob_ip}
                          onChange={(event) => handleInputChange(index, event)}
                          placeholder="4G OOB IP"
                          className="w-full h-full px-2 bg-transparent text-sm text-pink-400 placeholder:text-pink-200/40 outline-none"
                        />
                      )}
                    </div>
                  )}
                  {hasDeployStatus && (
                    <div className="flex items-center justify-center gap-1 border-r border-pink-200/10">
                      {deviceDeployStatus[index]?.status === "pending" ? (
                        <span
                          className="w-4 h-4 rounded-full border-2 border-pink-400/40 border-t-pink-400 animate-spin"
                          title="Deploying…"
                        />
                      ) : deviceDeployStatus[index]?.status === 1 ? (
                        <span className="text-green-400 text-base" title="Deployed">
                          ✓
                        </span>
                      ) : deviceDeployStatus[index]?.status === 0 ? (
                        <>
                          <span className="text-red-400 text-base" title="Deploy failed">
                            ✗
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRedeployDevice(index)}
                            title="Redeploy this device"
                            className="appearance-none bg-transparent border-0 p-0 text-pink-400 hover:text-pink-500 transition-colors text-sm leading-none"
                          >
                            ↻
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveDevice(index)}
                      title="Remove this device"
                      className="flex items-center"
                    >
                      <RedMinusIcon size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Ghost rows — shown while dragging to preview new rows */}
              {dragState.active &&
                devices.length < 500 &&
                Array.from({ length: 500 - devices.length }).map((_, i) => {
                  const ghostIndex = devices.length + i;
                  const isActive = ghostIndex <= dragState.toIndex;
                  const sourceValue = devices[dragState.fromIndex]?.[dragState.field] ?? "";
                  const previewValue =
                    dragState.field === "name"
                      ? incrementName(sourceValue, ghostIndex - dragState.fromIndex)
                      : sourceValue;
                  return (
                    <div
                      key={`ghost-${ghostIndex}`}
                      className={`grid border-b border-dashed h-10 transition-colors ${
                        isActive ? "border-pink-400/50 bg-pink-400/10" : "border-pink-200/10 opacity-20"
                      }`}
                      style={{ gridTemplateColumns: gridColsTemplate }}
                      onMouseMove={() => {
                        if (dragState.active) {
                          setDragState((prev) => ({ ...prev, toIndex: ghostIndex }));
                        }
                      }}
                    >
                      <div className="flex items-center justify-center text-xs text-pink-200/50 border-r border-dashed border-pink-200/10 select-none">
                        {ghostIndex + 1}
                      </div>
                      <div className="border-r border-dashed border-pink-200/10" />
                      <div className={`border-r border-dashed border-pink-200/10 flex items-center px-2 text-xs italic ${isActive ? "text-pink-800" : ""}`}>
                        {dragState.field === "name" ? previewValue : ""}
                      </div>
                      <div className={`border-r border-dashed border-pink-200/10 flex items-center px-2 text-xs italic ${isActive ? "text-pink-800" : ""}`}>
                        {dragState.field === "model" ? previewValue : ""}
                      </div>
                      <div className="border-r border-dashed border-pink-200/10" />
                      {hasACM && <div className="border-r border-dashed border-pink-200/10" />}
                      {hasDeployStatus && <div className="border-r border-dashed border-pink-200/10" />}
                      <div />
                    </div>
                  );
                })}
            </div>
          </div>

          {devices.length < 500 && (
            <div className="flex justify-start">
              <div className="m-2 flex gap-2">
                <Button
                  onPress={handleAddDevice}
                  isIconOnly
                  variant="bordered"
                  size="sm"
                  className="border-pink-500/60 text-pink-400 hover:border-pink-400 hover:bg-pink-400/10 rounded-md transition-colors"
                >
                  <GreenPlusIcon size={16} fill="currentColor" />
                </Button>

                <div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      id="csvUploadManageDevice"
                      className="hidden"
                      onChange={handleImportCSV}
                    />
                    <Button
                      onPress={() => document.getElementById("csvUploadManageDevice").click()}
                      size="sm"
                      variant="bordered"
                      className="border-sky-500/60 text-sky-400 hover:border-sky-400 hover:bg-sky-400/10 rounded-md text-xs transition-colors"
                    >
                      Import CSV
                    </Button>
                    <Button
                      onPress={() => {
                        setDevices([{ ...EMPTY_DEVICE }]);
                        document.getElementById("csvUploadManageDevice").value = "";
                        setCsvLimitWarning(false);
                      }}
                      size="sm"
                      variant="bordered"
                      className="border-rose-500/60 text-rose-400 hover:border-rose-400 hover:bg-rose-400/10 rounded-md text-xs transition-colors"
                    >
                      Clear CSV
                    </Button>
                  </div>
                  {csvLimitWarning && (
                    <p className="text-xs text-yellow-400 mt-1">CSV truncated to 500 devices (max limit).</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      isLoading={nextIpLoading}
                      onPress={handleFillIPs}
                      size="sm"
                      variant="bordered"
                      className="border-emerald-500/60 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-400/10 rounded-md text-xs transition-colors"
                    >
                      Fill IPs
                    </Button>
                    <Button
                      onPress={handleClearIPs}
                      size="sm"
                      variant="bordered"
                      className="border-rose-500/60 text-rose-400 hover:border-rose-400 hover:bg-rose-400/10 rounded-md text-xs transition-colors"
                    >
                      Clear IPs
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-2 flex justify-end">
            <Button size="sm" onPress={handleDeploy} isLoading={deployLoading} className="bg-pink-600">
              {deployLoading && deviceDeployStatus.length > 0
                ? `Deploying ${deviceDeployStatus.filter((d) => d.status !== "pending").length}/${deviceDeployStatus.length}…`
                : "Deploy Devices to Netbox"}
            </Button>
          </div>

          {(resultStatus === 0 || resultStatus === 1) && Array.isArray(resultLog) && resultLog.length > 0 && (
            <div className="w-full mt-4">
              <div
                className={`flex items-center justify-between px-3 py-2 bg-[#0d2438] rounded-t-lg border ${
                  resultStatus === 0 ? "border-red-500/50" : "border-green-500/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Results</span>
                  <button
                    onClick={() => setLogFilter(logFilter === 1 ? null : 1)}
                    className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                      logFilter === 1 ? "bg-green-600 text-white" : "bg-green-900/40 text-green-400 hover:bg-green-800/60"
                    }`}
                  >
                    ✓ {resultLog.filter((m) => m.status !== 0).length}
                  </button>
                  <button
                    onClick={() => setLogFilter(logFilter === 0 ? null : 0)}
                    className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                      logFilter === 0 ? "bg-red-600 text-white" : "bg-red-900/40 text-red-400 hover:bg-red-800/60"
                    }`}
                  >
                    ✗ {resultLog.filter((m) => m.status === 0).length}
                  </button>
                  {logFilter !== null && (
                    <button onClick={() => setLogFilter(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                      show all
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    const text = resultLog
                      .filter((m) => logFilter === null || m.status === logFilter)
                      .map((m) => `[${m.status === 0 ? "ERR" : " OK"}] ${m.msg}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    setLogsCopied(true);
                    setTimeout(() => setLogsCopied(false), 2000);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    logsCopied ? "bg-green-700 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                  }`}
                >
                  {logsCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div
                className={`overflow-y-auto max-h-[300px] bg-[#081b2a] border border-t-0 rounded-b-lg ${
                  resultStatus === 0 ? "border-red-500/50" : "border-green-500/50"
                }`}
              >
                {resultLog
                  .filter((m) => logFilter === null || m.status === logFilter)
                  .map((message, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 px-3 py-1.5 border-b border-white/5 text-xs font-mono last:border-0 ${
                        message.status === 0 ? "text-red-300" : "text-green-300"
                      }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 font-bold ${message.status === 0 ? "text-red-500" : "text-green-500"}`}>
                        {message.status === 0 ? "✗" : "✓"}
                      </span>
                      <span>{message.msg}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
