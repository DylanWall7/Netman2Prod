import React, { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import {
  Autocomplete,
  AutocompleteItem,
  Select,
  SelectItem,
} from "@nextui-org/react";

function FetchError({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
      <div className="flex items-center gap-2">
        <svg
          className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-xs text-red-400">{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="text-xs text-pink-500 hover:text-pink-400 hover:underline ml-3 flex-shrink-0"
      >
        Retry
      </button>
    </div>
  );
}

export default function ScanSettings({
  tabId,
  settings,
  onSettingsChange,
  locked,
  onReset,
  styles,
}) {
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };
  const baseUrl = `https://${process.env.REACT_APP_API_BASEURL}`;

  const [optionalOpen, setOptionalOpen] = useState(false);
  const [activeOptional, setActiveOptional] = useState([]);

  const OPTIONAL_FIELDS = [
    { key: "purchase_date", label: "Purchase Date", type: "date" },
    { key: "purchase_cost", label: "Purchase Cost", type: "number" },
    { key: "order_number", label: "Order Number", type: "text" },
  ];

  function toggleOptionalField(key) {
    setActiveOptional((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (!next.includes(key)) onSettingsChange({ [key]: "" });
      return next;
    });
  }

  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [statusLabels, setStatusLabels] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [errorLocations, setErrorLocations] = useState(null);
  const [errorMeta, setErrorMeta] = useState(null);
  const [errorModels, setErrorModels] = useState(null);

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
      await instance.acquireTokenRedirect(request);
      return null;
    }
  };

  const safeArray = (data) =>
    Array.isArray(data) ? data : data?.data || data?.rows || [];

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    setErrorLocations(null);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/snipeit/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? "Session expired — please log in again."
            : `Failed to load locations (${res.status})`,
        );
      setLocations(safeArray(await res.json()));
    } catch (err) {
      setErrorLocations(err.message || "Failed to load locations");
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    setErrorMeta(null);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [catRes, statusRes] = await Promise.all([
        fetch(`${baseUrl}/api/snipeit/categories`, { headers }),
        fetch(`${baseUrl}/api/snipeit/statuslabels`, { headers }),
      ]);
      if (!catRes.ok)
        throw new Error(
          catRes.status === 401
            ? "Session expired — please log in again."
            : `Failed to load categories (${catRes.status})`,
        );
      if (!statusRes.ok)
        throw new Error(
          statusRes.status === 401
            ? "Session expired — please log in again."
            : `Failed to load status labels (${statusRes.status})`,
        );
      setCategories(safeArray(await catRes.json()));
      setStatusLabels(safeArray(await statusRes.json()));
    } catch (err) {
      setErrorMeta(err.message || "Failed to load categories/status labels");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  const fetchModels = useCallback(async (categoryId) => {
    if (!categoryId) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    setErrorModels(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${baseUrl}/api/snipeit/models?category_id=${categoryId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? "Session expired — please log in again."
            : `Failed to load models (${res.status})`,
        );
      setModels(safeArray(await res.json()));
    } catch (err) {
      setErrorModels(err.message || "Failed to load models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);
  useEffect(() => {
    fetchMeta();
  }, []);
  useEffect(() => {
    fetchModels(settings.categoryId);
  }, [settings.categoryId]);

  const lockedBanner = locked && (
    <div className="flex items-center justify-between mb-3 px-3 py-1.5 bg-gray-700 rounded-lg">
      <span className="text-xs text-gray-500">Settings locked</span>
      <button
        onClick={onReset}
        className={`text-xs font-medium ${styles.accentText} hover:underline`}
      >
        Reset
      </button>
    </div>
  );

  if (tabId === "depot") {
    return (
      <div className="space-y-3">
        {lockedBanner}
        <div className="dark text-foreground space-y-3">
          {errorLocations ? (
            <FetchError message={errorLocations} onRetry={fetchLocations} />
          ) : (
            <Autocomplete
              label="Select Depot Location"
              isDisabled={locked || loadingLocations}
              isLoading={loadingLocations}
              selectedKey={
                settings.locationId ? String(settings.locationId) : null
              }
              onSelectionChange={(key) => {
                const loc = locations.find((l) => String(l.id) === String(key));
                onSettingsChange({
                  locationId: key ?? null,
                  locationName: loc?.name || "",
                });
              }}
              onInputChange={(value) => {
                if (!value) onSettingsChange({ locationId: null, locationName: "" });
              }}
              size="sm"
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {locations.map((loc) => (
                <AutocompleteItem key={String(loc.id)} value={String(loc.id)}>
                  {loc.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          )}

          {errorMeta ? (
            <FetchError message={errorMeta} onRetry={fetchMeta} />
          ) : (
            <Select
              label="Status Label (optional)"
              isDisabled={locked || loadingMeta}
              isLoading={loadingMeta}
              selectedKeys={
                settings.statusId ? [String(settings.statusId)] : []
              }
              onSelectionChange={(keys) => {
                const id = [...keys][0];
                const sl = statusLabels.find(
                  (s) => String(s.id) === String(id),
                );
                onSettingsChange({ statusId: id, statusName: sl?.name || "" });
              }}
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {statusLabels.map((sl) => (
                <SelectItem key={String(sl.id)} value={String(sl.id)}>
                  {sl.name}
                </SelectItem>
              ))}
            </Select>
          )}
        </div>
      </div>
    );
  }

  if (tabId === "location") {
    return (
      <div className="space-y-3">
        {lockedBanner}
        <div className="dark text-foreground space-y-3">
          {errorLocations ? (
            <FetchError message={errorLocations} onRetry={fetchLocations} />
          ) : (
            <Autocomplete
              label="Select Location"
              isDisabled={locked || loadingLocations}
              isLoading={loadingLocations}
              selectedKey={
                settings.locationId ? String(settings.locationId) : null
              }
              onSelectionChange={(key) => {
                const loc = locations.find((l) => String(l.id) === String(key));
                onSettingsChange({
                  locationId: key ?? null,
                  locationName: loc?.name || "",
                });
              }}
              onInputChange={(value) => {
                if (!value) onSettingsChange({ locationId: null, locationName: "" });
              }}
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {locations.map((loc) => (
                <AutocompleteItem key={String(loc.id)} value={String(loc.id)}>
                  {loc.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          )}

          {errorMeta ? (
            <FetchError message={errorMeta} onRetry={fetchMeta} />
          ) : (
            <Select
              label="Status Label"
              isDisabled={locked || loadingMeta}
              isLoading={loadingMeta}
              selectedKeys={
                settings.statusId ? [String(settings.statusId)] : []
              }
              onSelectionChange={(keys) => {
                const id = [...keys][0];
                const sl = statusLabels.find(
                  (s) => String(s.id) === String(id),
                );
                onSettingsChange({ statusId: id, statusName: sl?.name || "" });
              }}
              size="sm"
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {statusLabels.map((sl) => (
                <SelectItem key={String(sl.id)} value={String(sl.id)}>
                  {sl.name}
                </SelectItem>
              ))}
            </Select>
          )}

          <textarea
            disabled={locked}
            value={settings.notes || ""}
            onChange={(e) => onSettingsChange({ notes: e.target.value })}
            placeholder="Notes (optional) — e.g. RMA, damage description..."
            rows={2}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-600 bg-gray-700
                       text-gray-200 placeholder:text-gray-500 resize-y min-h-[56px]
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          />
        </div>
      </div>
    );
  }

  if (tabId === "jobout") {
    return (
      <div>
        {lockedBanner}
        <div className="dark text-foreground">
          {errorLocations ? (
            <FetchError message={errorLocations} onRetry={fetchLocations} />
          ) : (
            <Autocomplete
              label="Select Job Location"
              isDisabled={locked || loadingLocations}
              isLoading={loadingLocations}
              selectedKey={
                settings.locationId ? String(settings.locationId) : null
              }
              onSelectionChange={(key) => {
                const loc = locations.find((l) => String(l.id) === String(key));
                onSettingsChange({
                  locationId: key ?? null,
                  locationName: loc?.name || "",
                });
              }}
              onInputChange={(value) => {
                if (!value) onSettingsChange({ locationId: null, locationName: "" });
              }}
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {locations.map((loc) => (
                <AutocompleteItem key={String(loc.id)} value={String(loc.id)}>
                  {loc.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          )}
        </div>
      </div>
    );
  }

  if (tabId === "add") {
    return (
      <div className="space-y-3">
        {lockedBanner}
        <div className="dark text-foreground space-y-3">
          {errorLocations ? (
            <FetchError message={errorLocations} onRetry={fetchLocations} />
          ) : (
            <Autocomplete
              label="Select Location"
              isDisabled={locked || loadingLocations}
              isLoading={loadingLocations}
              selectedKey={
                settings.locationId ? String(settings.locationId) : null
              }
              onSelectionChange={(key) => {
                const loc = locations.find((l) => String(l.id) === String(key));
                onSettingsChange({
                  locationId: key ?? null,
                  locationName: loc?.name || "",
                });
              }}
              onInputChange={(value) => {
                if (!value) onSettingsChange({ locationId: null, locationName: "" });
              }}
              size="sm"
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {locations.map((loc) => (
                <AutocompleteItem key={String(loc.id)} value={String(loc.id)}>
                  {loc.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          )}

          {errorMeta ? (
            <FetchError message={errorMeta} onRetry={fetchMeta} />
          ) : (
            <>
              <Select
                label="Category"
                isDisabled={locked || loadingMeta}
                isLoading={loadingMeta}
                selectedKeys={
                  settings.categoryId ? [String(settings.categoryId)] : []
                }
                onSelectionChange={(keys) => {
                  const id = [...keys][0];
                  const cat = categories.find(
                    (c) => String(c.id) === String(id),
                  );
                  onSettingsChange({
                    categoryId: id,
                    categoryName: cat?.name || "",
                    modelId: null,
                    modelName: "",
                  });
                }}
                variant="bordered"
                classNames={{ base: "w-full" }}
              >
                {categories.map((cat) => (
                  <SelectItem key={String(cat.id)} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </Select>

              <Select
                label="Status Label"
                isDisabled={locked || loadingMeta}
                isLoading={loadingMeta}
                selectedKeys={
                  settings.statusId ? [String(settings.statusId)] : []
                }
                onSelectionChange={(keys) => {
                  const id = [...keys][0];
                  const sl = statusLabels.find(
                    (s) => String(s.id) === String(id),
                  );
                  onSettingsChange({
                    statusId: id,
                    statusName: sl?.name || "",
                  });
                }}
                variant="bordered"
                classNames={{ base: "w-full" }}
              >
                {statusLabels.map((sl) => (
                  <SelectItem key={String(sl.id)} value={String(sl.id)}>
                    {sl.name}
                  </SelectItem>
                ))}
              </Select>
            </>
          )}

          {errorModels ? (
            <FetchError
              message={errorModels}
              onRetry={() => fetchModels(settings.categoryId)}
            />
          ) : (
            <Autocomplete
              label="Model"
              isDisabled={locked || !settings.categoryId || loadingModels}
              isLoading={loadingModels}
              selectedKey={settings.modelId ? String(settings.modelId) : null}
              onSelectionChange={(key) => {
                const model = models.find((m) => String(m.id) === String(key));
                onSettingsChange({
                  modelId: key ?? null,
                  modelName: model?.name || "",
                });
              }}
              onInputChange={(value) => {
                if (!value) onSettingsChange({ modelId: null, modelName: "" });
              }}
              size="sm"
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {models.map((model) => (
                <AutocompleteItem
                  key={String(model.id)}
                  value={String(model.id)}
                >
                  {model.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          )}

          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <button
              type="button"
              disabled={locked}
              onClick={() => setOptionalOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-medium">Optional fields</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-150 ${optionalOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {optionalOpen && (
              <div className="border-t border-gray-700 p-2 space-y-2">
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {OPTIONAL_FIELDS.map((f) => {
                    const active = activeOptional.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleOptionalField(f.key)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? "bg-pink-600/30 border-pink-500/60 text-pink-300"
                            : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500"
                        }`}
                      >
                        {active ? "✓ " : "+ "}{f.label}
                      </button>
                    );
                  })}
                </div>

                {OPTIONAL_FIELDS.filter((f) => activeOptional.includes(f.key)).map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      disabled={locked}
                      value={settings[f.key] || ""}
                      onChange={(e) => onSettingsChange({ [f.key]: e.target.value })}
                      step={f.type === "number" ? "0.01" : undefined}
                      min={f.type === "number" ? "0" : undefined}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-600 bg-gray-700
                                 text-gray-200 placeholder:text-gray-500
                                 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 bg-gray-700 rounded-lg">
            <p className="text-xs text-gray-500">
              Asset tag and serial number are auto-filled from the scanned
              serial
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (tabId === "status") {
    return (
      <div className="px-3 py-2 bg-gray-700 rounded-lg">
        <p className="text-xs text-gray-500">
          Scan a serial number to look up its current status, location, and
          assignment. No changes will be made.
        </p>
      </div>
    );
  }

  return null;
}
