import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { useDepotOrdersToken } from "./depotOrdersApi";

const SITES_URL = `https://${process.env.REACT_APP_API_BASEURL}/api/management/netbox/sites/`;

let sitesCache = null;
let sitesCachePromise = null;

function fetchSites(getToken) {
  if (sitesCache) return Promise.resolve(sitesCache);
  if (!sitesCachePromise) {
    sitesCachePromise = (async () => {
      const token = await getToken();
      const res = await fetch(SITES_URL, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
      const data = await res.json();
      sitesCache = data;
      return data;
    })().catch((err) => {
      sitesCachePromise = null;
      throw err;
    });
  }
  return sitesCachePromise;
}

export default function SiteAutocomplete({ value, onChange }) {
  const getToken = useDepotOrdersToken();
  const [sites, setSites] = useState(sitesCache || []);
  const [isLoading, setIsLoading] = useState(!sitesCache);

  useEffect(() => {
    if (sitesCache) return;
    setIsLoading(true);
    fetchSites(getToken)
      .then(setSites)
      .catch(() => setSites([]))
      .finally(() => setIsLoading(false));
  }, [getToken]);

  return (
    <div className="dark text-foreground">
      <Autocomplete
        size="sm"
        label="Site Code (From Netbox)"
        menuTrigger="input"
        placeholder="Site Code"
        variant="bordered"
        isLoading={isLoading}
        selectedKey={value || null}
        onSelectionChange={(key) => onChange(key ?? "")}
        onInputChange={(text) => {
          if (!text) onChange("");
        }}
        inputProps={{
          classNames: {
            inputWrapper: "bg-gray-700 border-gray-600 data-[hover=true]:bg-gray-700 group-data-[focus=true]:border-pink-500",
            input: "text-gray-100 placeholder:text-gray-500",
            label: "text-gray-400",
          },
        }}
        classNames={{
          popoverContent: "bg-gray-800 border border-gray-700",
          listbox: "text-gray-100",
        }}
      >
        {sites.map((site) => (
          <AutocompleteItem key={site.name} value={site.name}>
            {site.name || "No Site Code"}
          </AutocompleteItem>
        ))}
      </Autocomplete>
    </div>
  );
}
