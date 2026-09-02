import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import {
  Autocomplete,
  AutocompleteItem,
  Select,
  SelectItem,
  Button,
} from "@nextui-org/react";
import { useSearchParams } from "react-router-dom";

export const DemobeStepper = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [siteCode, setSiteCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [postStatus, setPostStatus] = useState(null);
  const [createNetbox, setCreateNetbox] = useState([]);
  const [skeletonLoading, setSkeletonLoading] = useState(false);
  const [siteList, setSiteList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);
  const [logFilter, setLogFilter] = useState(null);
  const [resultKey, setResultKey] = useState(0);
  const [selectedDays, setSelectedDays] = useState(() => {
    const daysParam = searchParams.get("days");
    return daysParam ? parseInt(daysParam, 10) : 90;
  });
  const [siteLoadError, setSiteLoadError] = useState(null);
  const [dhcpCheckLoading, setDhcpCheckLoading] = useState(false);
  const [dhcpChecked, setDhcpChecked] = useState(false);
  const [keaDhcpScopes, setKeaDhcpScopes] = useState([]);
  const [gizmoDhcpScopes, setGizmoDhcpScopes] = useState([]);
  const [dhcpCheckError, setDhcpCheckError] = useState(null);
  const [scopesCopied, setScopesCopied] = useState(false);
  const [dhcpDeleted, setDhcpDeleted] = useState(false);
  const [stepRuns, setStepRuns] = useState({});
  const [summaryCopied, setSummaryCopied] = useState(false);

  const siteurl = `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/snowlocations/${selectedDays}`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  const getToken = async () => {
    try {
      const res = await instance.acquireTokenSilent(request);
      return res.accessToken;
    } catch {
      // Full-page redirect, not a popup — this app's redirectUri points at the SPA root, so
      // a popup just loads the whole app inside itself instead of closing. Redirect reuses
      // the already-registered URI (no Azure changes needed) and navigates the tab away, so
      // this never meaningfully returns — the user lands back freshly authenticated and
      // just retries whatever they were doing.
      await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
      return null;
    }
  };

  function summarizeLog(log) {
    if (!Array.isArray(log) || log.length === 0) return "Completed — no details returned.";
    const total = log.length;
    const failed = log.filter((m) => m.status === 0).length;
    const succeeded = total - failed;
    if (failed === 0) return `All ${total} succeeded.`;
    if (succeeded === 0) return `All ${total} failed.`;
    return `${succeeded} succeeded, ${failed} failed (of ${total}).`;
  }

  const recordStepRun = (stepIndex, status, log) => {
    setStepRuns((prev) => ({
      ...prev,
      [stepIndex]: [
        ...(prev[stepIndex] || []),
        { status, log: log || [], summary: summarizeLog(log), timestamp: Date.now() },
      ],
    }));
  };

  const ordinalWords = ["first", "second", "third", "fourth", "fifth", "sixth"];
  function describeRuns(runs) {
    if (!runs || runs.length === 0) return { text: "Not run.", tone: "muted" };
    const last = runs[runs.length - 1];
    const tone = last.status === 0 ? "bad" : "good";
    if (runs.length === 1) return { text: last.summary, tone };
    const attempts = runs
      .map((r, i) => `${ordinalWords[i] || `${i + 1}th`} time ${r.status === 0 ? "failed" : "succeeded"}`)
      .join(", ");
    return { text: `Ran ${runs.length}x — ${attempts}. Latest: ${last.summary}`, tone };
  }

  const daysOptions = [
    { key: "30", label: "30 Days" },
    { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" },
    { key: "180", label: "180 Days" },
    { key: "365", label: "365 Days" },
  ];

  const handleDaysChange = (e) => {
    const newDays = Number(e.target.value);
    setSelectedDays(newDays);
    setSearchParams({ days: newDays.toString() });
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setSiteLoadError(null);
      try {
        const token = await getToken();
        GetAllSites({ token });
      } catch (err) {
        setIsLoading(false);
        setSiteLoadError(
          err.message || "Failed to load sites — please try again.",
        );
      }
    })();
  }, [accounts.length === 0, selectedDays]);


  async function GetAllSites({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "GET",
      headers: headers,
    };

    return fetch(siteurl, options)
      .then(async (response) => {
        let text = await response.json();
        setSiteList(text);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  const checkDhcpScopes = async () => {
    setDhcpCheckLoading(true);
    setDhcpChecked(false);
    setDhcpCheckError(null);
    setKeaDhcpScopes([]);
    setGizmoDhcpScopes([]);
    try {
      const token = await getToken();
      const baseUrl = `https://${process.env.REACT_APP_API_BASEURL}/api`;
      const opts = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };
      const [keaRes, gizmoRes] = await Promise.all([
        fetch(`${baseUrl}/provisioning/dhcp/${siteCode}`, opts),
        fetch(`${baseUrl}/provisioning/dhcp/${siteCode}/gizmo`, opts).catch(() => null),
      ]);
      const keaData = keaRes.ok ? await keaRes.json() : [];
      const gizmoData = gizmoRes?.ok ? await gizmoRes.json() : [];
      setKeaDhcpScopes(Array.isArray(keaData) ? keaData : (keaData?.scopes ?? []));
      setGizmoDhcpScopes(Array.isArray(gizmoData) ? gizmoData : (gizmoData?.scopes ?? []));
      setDhcpChecked(true);
    } catch {
      setDhcpCheckError("Failed to check DHCP scopes — please try again.");
    } finally {
      setDhcpCheckLoading(false);
    }
  };

  const copyGizmoText = () => {
    const text = [
      `Site Code: ${siteCode}`,
      "Gizmo DHCP Scopes to Delete:",
      ...gizmoDhcpScopes.map((s) => `  - ${[s.scopeID ?? s.scopeId, s.name].filter(Boolean).join(" — ")}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setScopesCopied(true);
    setTimeout(() => setScopesCopied(false), 2000);
  };

  const SUMMARY_STEP = 5;

  const steps = [
    { id: 1, label: "Enter Site Code", short: "Site", url: `` },
    {
      id: 2,
      label: "Delete DHCP Scopes",
      short: "DHCP",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/dhcp/${siteCode}`,
    },
    {
      id: 3,
      label: "Unassign Mist Devices",
      short: "Unassign",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/mist/site/${siteCode}/devices`,
    },
    {
      id: 4,
      label: "Delete Mist Site",
      short: "Del Mist",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/mist/site/${siteCode}`,
    },
    {
      id: 5,
      label: "Delete Netbox Site",
      short: "Del Netbox",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/netbox/site/${siteCode}`,
    },
    { id: 6, label: "Summary", short: "Summary" },
  ];

  const copySummaryText = () => {
    const lines = [`Demobe Summary — ${siteCode}`, `Generated: ${new Date().toLocaleString()}`, ""];
    [1, 2, 3, 4].forEach((idx) => {
      const runs = stepRuns[idx];
      const { text } = describeRuns(runs);
      lines.push(`${steps[idx].label}: ${text}`);
      const latestRun = runs && runs.length > 0 ? runs[runs.length - 1] : null;
      (latestRun?.log || []).forEach((item) => {
        lines.push(`  [${item.status === 0 ? "ERR" : " OK"}] ${item.msg}`);
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n").trim());
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2000);
  };

  const handleDelete = async () => {
    setShowModal(false);
    setSkeletonLoading(true);
    setCreateNetbox([]);
    setPostStatus(null);

    try {
      const token = await getToken();
      const { url } = steps[currentStep];

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const msg = `Server error ${response.status}${response.statusText ? ` — ${response.statusText}` : ""}`;
        setCreateNetbox([{ msg, status: 0 }]);
        setPostStatus(0);
        setResultKey((k) => k + 1);
        setSkeletonLoading(false);
        recordStepRun(currentStep, 0, [{ msg, status: 0 }]);
        return;
      }

      const Postresponse = await response.json();
      if (currentStep === 1) setDhcpDeleted(true);
      setCreateNetbox(Postresponse?.log);
      setPostStatus(Postresponse?.status);
      setResultKey((k) => k + 1);
      setSkeletonLoading(false);
      recordStepRun(currentStep, Postresponse?.status, Postresponse?.log);
    } catch (err) {
      const msg = err.message || "Unexpected error — check your connection and try again.";
      setCreateNetbox([{ msg, status: 0 }]);
      setPostStatus(0);
      setResultKey((k) => k + 1);
      setSkeletonLoading(false);
      recordStepRun(currentStep, 0, [{ msg, status: 0 }]);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      if (currentStep === 0 && siteCode) {
        checkDhcpScopes();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  return (
    <>
      <div className="mt-8 text-white flex flex-col items-center justify-center p-6">
        <div className="">
          <div className="  ml-5">
            <div className="max-w-3xl mx-auto text-center mt-4">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-red-500">
                  Demobe Wizard
                </span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500"></span>
              </h1>
              <p className="text-sm text-pink-400 mb-8">
                Demobe a site with the following steps.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center mb-10 flex-wrap gap-y-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5 w-16">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                    index === currentStep
                      ? "bg-pink-500 text-pink-100"
                      : "bg-pink-700 border border-pink-200/30"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-[10px] leading-tight text-center ${
                    index === currentStep ? "text-pink-500 font-semibold" : "text-pink-200"
                  }`}
                >
                  {step.short}
                </span>
              </div>
              {index !== steps.length - 1 && (
                <div
                  className={`w-6 h-1 mt-5 shrink-0 rounded-full transition-colors ${
                    index < currentStep ? "bg-pink-500" : "bg-pink-300"
                  }`}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          className={`w-full ${
            currentStep === SUMMARY_STEP ? "max-w-2xl" : "max-w-xl"
          } bg-pink-700 border border-pink-200/20 rounded-2xl shadow-lg p-6 text-center`}
        >
          <h2 className="text-xl font-bold mb-4 pb-3 border-b border-pink-200/15">
            {steps[currentStep].label}
          </h2>

          {currentStep === 0 ? (
            <div className="p-2">
              <div className="dark text-foreground flex gap-3 items-start">
                <div className="flex-shrink-0" style={{ width: "140px" }}>
                  <Select
                    label="Closed in Last"
                    size="sm"
                    selectedKeys={[String(selectedDays)]}
                    onChange={handleDaysChange}
                    variant="bordered"
                  >
                    {daysOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex-1">
                  <Autocomplete
                    size="sm"
                    label="Site Code (From ServiceNow)"
                    menuTrigger="input"
                    placeholder="Site Code"
                    className="text-pink-400"
                    variant="bordered"
                    isLoading={isLoading}
                    selectedKey={siteCode || null}
                    onSelectionChange={(key) => {
                      setSiteCode(key ?? "");
                      setDhcpChecked(false);
                      setKeaDhcpScopes([]);
                      setGizmoDhcpScopes([]);
                      setDhcpDeleted(false);
                      setCreateNetbox([]);
                      setPostStatus(null);
                      setStepRuns({});
                    }}
                    onInputChange={(value) => {
                      if (!value) {
                        setSiteCode("");
                        setDhcpChecked(false);
                        setKeaDhcpScopes([]);
                        setGizmoDhcpScopes([]);
                        setDhcpDeleted(false);
                        setCreateNetbox([]);
                        setPostStatus(null);
                        setStepRuns({});
                      }
                    }}
                  >
                    {siteList.data?.map((site) => (
                      <AutocompleteItem value={site} key={site}>
                        {site ? site : "No Site Code"}
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                </div>
              </div>
            </div>
          ) : currentStep === 1 ? (
            <div className="text-left">
              <p className="text-sm text-center mb-4">
                Site Code:{" "}
                <span className="font-mono text-pink-500">{siteCode || "N/A"}</span>
              </p>

              {dhcpCheckLoading && (
                <div className="flex flex-col gap-2 mt-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
              )}

              {!dhcpCheckLoading && dhcpCheckError && (
                <div className="text-center space-y-3 mt-2">
                  <p className="text-red-400 text-sm">{dhcpCheckError}</p>
                  <button
                    onClick={checkDhcpScopes}
                    className="text-xs px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-black transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {dhcpDeleted && (
                <div className="rounded-lg border border-green-600/50 bg-green-900/20 p-4 mt-2 text-center">
                  <p className="text-green-400 text-sm font-semibold">DHCP Scopes Deleted</p>
                </div>
              )}

              {!dhcpDeleted && !dhcpCheckLoading && dhcpChecked && (
                <div className="space-y-4 mt-2">
                  {gizmoDhcpScopes.length > 0 && (
                    <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 p-4">
                      <p className="text-yellow-400 text-sm font-semibold mb-1">
                        Gizmo DHCP — Open a Ticket
                      </p>
                      <p className="text-yellow-200/70 text-xs mb-3">
                        {gizmoDhcpScopes.length === 1
                          ? "This scope is managed by Gizmo DHCP and cannot be deleted here. Please open a ticket with the details below."
                          : `These ${gizmoDhcpScopes.length} scopes are managed by Gizmo DHCP and cannot be deleted here. Please open a ticket with the details below.`}
                      </p>
                      <ul className="space-y-1 mb-3">
                        {gizmoDhcpScopes.map((scope, i) => (
                          <li key={i} className="text-xs font-mono text-yellow-100 bg-yellow-900/30 rounded px-2 py-1">
                            {[scope.scopeID ?? scope.scopeId, scope.name].filter(Boolean).join(" — ")}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={copyGizmoText}
                        className={`text-xs px-3 py-1.5 rounded transition-colors w-full ${
                          scopesCopied
                            ? "bg-green-700 text-white"
                            : "bg-yellow-700/60 hover:bg-yellow-600/60 text-yellow-100"
                        }`}
                      >
                        {scopesCopied ? "Copied!" : "Copy Site Code + Scopes"}
                      </button>
                    </div>
                  )}

                  {keaDhcpScopes.length > 0 && (
                    <div className="rounded-lg border border-red-600/50 bg-red-900/20 p-4">
                      <p className="text-red-400 text-sm font-semibold mb-1">
                        Kea DHCP — {keaDhcpScopes.length} Scope{keaDhcpScopes.length > 1 ? "s" : ""} to Delete
                      </p>
                      <p className="text-red-200/70 text-xs mb-3">
                        The following scopes will be permanently deleted.
                      </p>
                      <ul className="space-y-1 mb-3">
                        {keaDhcpScopes.map((scope, i) => (
                          <li key={i} className="text-xs font-mono text-red-100 bg-red-900/30 rounded px-2 py-1">
                            {scope.subnet ?? scope.scopeId ?? scope.id}
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        onPress={() => setShowModal(true)}
                        isDisabled={skeletonLoading}
                        isLoading={skeletonLoading}
                        className="bg-red-600 text-white hover:bg-red-500 w-full"
                      >
                        Delete These Scopes
                      </Button>
                    </div>
                  )}

                  {keaDhcpScopes.length === 0 && gizmoDhcpScopes.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-4">
                      No DHCP scopes found for{" "}
                      <span className="font-mono text-pink-500">{siteCode}</span>.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : currentStep === SUMMARY_STEP ? (
            <div className="text-left">
              <div className="p-2">
                <h2 className="text-pink-400 text-lg font-bold text-center">
                  Summary for {siteCode}
                </h2>
              </div>
              <div className="mx-2 mb-3 rounded-lg border border-pink-200/15 divide-y divide-pink-200/10 text-left overflow-y-auto max-h-[420px]">
                {[1, 2, 3, 4].map((idx) => {
                  const runs = stepRuns[idx];
                  const { text, tone } = describeRuns(runs);
                  const latestRun = runs && runs.length > 0 ? runs[runs.length - 1] : null;
                  const failedItems = latestRun?.log?.filter((m) => m.status === 0) || [];
                  return (
                    <div key={idx} className="px-3 py-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span
                          className={`font-bold shrink-0 ${
                            tone === "bad" ? "text-red-400" : tone === "good" ? "text-green-400" : "text-pink-200/40"
                          }`}
                        >
                          {tone === "bad" ? "✗" : tone === "good" ? "✓" : "–"}
                        </span>
                        <span>
                          <span className="font-semibold text-pink-400">{steps[idx].short}:</span>{" "}
                          <span className="text-pink-200">{text}</span>
                        </span>
                      </div>
                      {failedItems.length > 0 && (
                        <ul className="mt-1.5 ml-6 list-disc space-y-1 text-red-300/90 marker:text-red-400/60">
                          {failedItems.map((item, i) => (
                            <li key={i}>{item.msg}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <Button
                  size="sm"
                  onPress={copySummaryText}
                  className={
                    summaryCopied
                      ? "bg-green-700 text-white"
                      : "bg-pink-600 text-black hover:bg-pink-500"
                  }
                >
                  {summaryCopied ? "Copied!" : "Copy Summary for ServiceNow"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-lg mb-4">
                Site Code:{" "}
                <span className="font-mono text-pink-500">
                  {siteCode || "N/A"}
                </span>
              </p>
              <Button
                size="sm"
                onPress={() => setShowModal(true)}
                className="bg-red-600 text-white hover:bg-red-500"
              >
                {steps[currentStep].label}
              </Button>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button
              size="sm"
              onPress={prevStep}
              isDisabled={currentStep === 0}
              className="bg-pink-300 border border-pink-200/20 text-pink-400 hover:bg-pink-200/20"
            >
              Back
            </Button>
            {currentStep < steps.length - 1 && (
              <Button
                size="sm"
                variant="bordered"
                onPress={nextStep}
                isDisabled={skeletonLoading || (currentStep === 0 && !siteCode)}
                isLoading={skeletonLoading}
                className="border-pink-500 text-pink-500 hover:bg-pink-500/10"
              >
                Next
              </Button>
            )}
          </div>
          {currentStep === 0 && !siteCode && (
            <p className="text-xs text-pink-200/50 text-center mt-2">
              Select a site to continue.
            </p>
          )}
        </div>
        <div className="mt-8">
          {skeletonLoading && (
            <div className="flex flex-col gap-2 ml-5 w-80">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gray-700 rounded animate-pulse"
                ></div>
              ))}
            </div>
          )}
        </div>

        {!skeletonLoading &&
          (postStatus === 0 || postStatus === 1) &&
          Array.isArray(createNetbox) &&
          createNetbox.length > 0 && (
            <div className="w-full max-w-2xl mx-auto mt-6">
              <div
                className={`flex items-center justify-between px-3 py-2 bg-[#0d2438] rounded-t-lg border ${postStatus === 0 ? "border-red-500/50" : postStatus === 1 ? "border-green-500/50" : "border-white/10"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {steps[currentStep]?.label ?? "Step"} Log
                  </span>
                  <button
                    onClick={() => setLogFilter(logFilter === 1 ? null : 1)}
                    className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                      logFilter === 1
                        ? "bg-green-600 text-white"
                        : "bg-green-900/40 text-green-400 hover:bg-green-800/60"
                    }`}
                  >
                    ✓ {createNetbox.filter((m) => m.status !== 0).length}
                  </button>
                  <button
                    onClick={() => setLogFilter(logFilter === 0 ? null : 0)}
                    className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                      logFilter === 0
                        ? "bg-red-600 text-white"
                        : "bg-red-900/40 text-red-400 hover:bg-red-800/60"
                    }`}
                  >
                    ✗ {createNetbox.filter((m) => m.status === 0).length}
                  </button>
                  {logFilter !== null && (
                    <button
                      onClick={() => setLogFilter(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      show all
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    const text = createNetbox
                      .filter((m) => logFilter === null || m.status === logFilter)
                      .map((m) => `[${m.status === 0 ? "ERR" : " OK"}] ${m.msg}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    setLogsCopied(true);
                    setTimeout(() => setLogsCopied(false), 2000);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    logsCopied
                      ? "bg-green-700 text-white"
                      : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                  }`}
                >
                  {logsCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div
                className={`overflow-y-auto max-h-[420px] bg-[#081b2a] border border-t-0 rounded-b-lg ${postStatus === 0 ? "border-red-500/50" : postStatus === 1 ? "border-green-500/50" : "border-white/10"}`}
              >
                {createNetbox.map((message, originalIndex) => (
                  <div
                    key={`${resultKey}-${originalIndex}`}
                    className={`flex items-start gap-2 px-3 py-1.5 border-b border-white/5 text-xs font-mono last:border-0 ${
                      message.status === 0
                        ? "text-red-300 animate-pulse10s"
                        : "text-green-300 animate-bounceOnce"
                    }`}
                    style={
                      logFilter !== null && message.status !== logFilter
                        ? {
                            height: 0,
                            overflow: "hidden",
                            padding: 0,
                            borderBottom: "none",
                            opacity: 0,
                          }
                        : {}
                    }
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 font-bold ${message.status === 0 ? "text-red-500" : "text-green-500"}`}
                    >
                      {message.status === 0 ? "✗" : "✓"}
                    </span>
                    <span>{message.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-pink-700 border border-pink-200/20 rounded-xl p-6 w-96 shadow-xl">
              <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
              <p className="text-pink-200 mb-6">
                Are you sure you want to {steps[currentStep].label} for{" "}
                <span className="font-semibold text-red-400">{siteCode}</span>?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-pink-300 border border-pink-200/20 hover:bg-pink-200/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
        {siteLoadError && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="text-red-400 text-sm max-w-sm font-semibold">
              {siteLoadError}
            </p>
            <button
              onClick={() => {
                setSiteLoadError(null);
                setIsLoading(true);
                getToken()
                  .then((token) => GetAllSites({ token }))
                  .catch((err) => {
                    setIsLoading(false);
                    setSiteLoadError(err.message || "Failed to load sites.");
                  });
              }}
              className="text-xs px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </>
  );
};
