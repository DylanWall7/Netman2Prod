import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import { Autocomplete, AutocompleteItem, Select, SelectItem } from "@nextui-org/react";

export default function AssetQuickEditModal({ serial, assetData, onClose, onSuccess }) {
  const { instance, accounts } = useMsal();
  const request = { ...GizmoRequest, account: accounts[0] };
  const baseUrl = `https://${process.env.REACT_APP_API_BASEURL}`;
  const isAdd = !assetData;

  const [statusLabels, setStatusLabels] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [statusId, setStatusId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [modelId, setModelId] = useState("");

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

  const safeArray = (data) => Array.isArray(data) ? data : data?.data || data?.rows || [];

  useEffect(() => {
    const load = async () => {
      setLoadingMeta(true);
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const fetches = [
          fetch(`${baseUrl}/api/snipeit/statuslabels`, { headers }),
          fetch(`${baseUrl}/api/snipeit/locations`, { headers }),
        ];
        if (isAdd) fetches.push(fetch(`${baseUrl}/api/snipeit/categories`, { headers }));
        const [statusRes, locRes, catRes] = await Promise.all(fetches);
        setStatusLabels(safeArray(await statusRes.json()));
        setLocations(safeArray(await locRes.json()));
        if (isAdd && catRes) setCategories(safeArray(await catRes.json()));
      } catch {}
      finally { setLoadingMeta(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!categoryId) { setModels([]); return; }
    const load = async () => {
      setLoadingModels(true);
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/snipeit/models?category_id=${categoryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setModels(safeArray(await res.json()));
      } catch {}
      finally { setLoadingModels(false); }
    };
    load();
  }, [categoryId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!statusId) { setError("Please select a status label"); return; }
    if (isAdd && (!modelId || !locationId)) { setError("Model and location are required"); return; }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      let res;
      if (isAdd) {
        res = await fetch(`${baseUrl}/api/snipeit/hardware`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ serial, asset_tag: serial, status_id: statusId, model_id: modelId, location_id: locationId }),
        });
      } else {
        const body = { status_id: statusId };
        if (locationId) body.location_id = locationId;
        res = await fetch(`${baseUrl}/api/snipeit/hardware/${serial}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status === "error") {
        setError(data?.messages || data?.message || "Save failed");
      } else {
        setSuccess(true);
        setTimeout(() => { onSuccess(); onClose(); }, 800);
      }
    } catch {
      setError("Network error — check connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {isAdd ? "Add Asset to Inventory" : "Quick Edit Asset"}
            </h2>
            <p className="text-xs text-pink-400 font-mono mt-0.5">{serial}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!isAdd && assetData && (
            <div className="px-3 py-2 bg-gray-700 rounded-lg flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>Current status: <span className="text-white font-medium">{assetData.status_label?.name || "—"}</span></span>
              {assetData.location?.name && <span>Location: <span className="text-white font-medium">{assetData.location.name}</span></span>}
              {assetData.assigned_to?.name && <span>Assigned: <span className="text-white font-medium">{assetData.assigned_to.name}</span></span>}
            </div>
          )}

          {isAdd && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
              This serial was not found in SnipeIT. Fill in the details below to add it.
            </div>
          )}

          <div className="dark text-foreground space-y-3">
            <Select
              label={isAdd ? "Status Label" : "New Status Label"}
              isLoading={loadingMeta}
              isDisabled={loadingMeta || saving}
              selectedKeys={statusId ? [String(statusId)] : []}
              onSelectionChange={(keys) => setStatusId([...keys][0] ?? "")}
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {statusLabels.map((sl) => (
                <SelectItem key={String(sl.id)}>{sl.name}</SelectItem>
              ))}
            </Select>

            {isAdd && (
              <>
                <Select
                  label="Category"
                  isLoading={loadingMeta}
                  isDisabled={loadingMeta || saving}
                  selectedKeys={categoryId ? [String(categoryId)] : []}
                  onSelectionChange={(keys) => { setCategoryId([...keys][0] ?? ""); setModelId(""); }}
                  variant="bordered"
                  classNames={{ base: "w-full" }}
                >
                  {categories.map((c) => (
                    <SelectItem key={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </Select>

                <Autocomplete
                  label="Model"
                  isDisabled={!categoryId || loadingModels || saving}
                  isLoading={loadingModels}
                  selectedKey={modelId ? String(modelId) : null}
                  onSelectionChange={(key) => setModelId(key ?? "")}
                  onInputChange={(value) => { if (!value) setModelId(""); }}
                  variant="bordered"
                  classNames={{ base: "w-full" }}
                >
                  {models.map((m) => (
                    <AutocompleteItem key={String(m.id)}>{m.name}</AutocompleteItem>
                  ))}
                </Autocomplete>
              </>
            )}

            <Autocomplete
              label={isAdd ? "Location" : "Update Location (optional)"}
              isDisabled={loadingMeta || saving}
              isLoading={loadingMeta}
              selectedKey={locationId ? String(locationId) : null}
              onSelectionChange={(key) => setLocationId(key ?? "")}
              onInputChange={(value) => { if (!value) setLocationId(""); }}
              variant="bordered"
              classNames={{ base: "w-full" }}
            >
              {locations.map((l) => (
                <AutocompleteItem key={String(l.id)}>{l.name}</AutocompleteItem>
              ))}
            </Autocomplete>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isAdd ? "Asset added — retrying scan…" : "Updated — retrying scan…"}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success || loadingMeta}
            className="px-4 py-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
            {isAdd ? "Add Asset" : "Save & Retry Scan"}
          </button>
        </div>

      </div>
    </div>
  );
}
