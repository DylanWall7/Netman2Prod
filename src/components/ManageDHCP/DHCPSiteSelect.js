import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { listSites, useSiteDashboardToken } from "../SiteDashboard/siteDashboardApi";

export default function DHCPSiteSelect() {
  const navigate = useNavigate();
  const getToken = useSiteDashboardToken();

  const [sites, setSites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const data = await listSites(token);
        if (!cancelled) setSites(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load sites");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToSite = (code) => {
    const trimmed = (code || "").trim();
    if (trimmed) navigate(`/dhcp/${trimmed}`);
  };

  return (
    <div className="text-gray-100 max-w-xl mx-auto py-16 px-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative inline-block">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            DHCP Manager
          </span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
        <p className="text-sm text-pink-400">Pick a site, or type its code and hit enter.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      <div className="dark text-foreground">
        <Autocomplete
          size="sm"
          label="Site Code"
          menuTrigger="input"
          placeholder="Search sites…"
          variant="bordered"
          isLoading={isLoading}
          allowsCustomValue
          inputValue={inputText}
          onInputChange={setInputText}
          onSelectionChange={(key) => {
            if (key) goToSite(key);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !sites.some((s) => s.name === inputText)) goToSite(inputText);
          }}
        >
          {sites.map((site) => (
            <AutocompleteItem key={site.name} value={site.name}>
              {site.name || "No Site Code"}
            </AutocompleteItem>
          ))}
        </Autocomplete>
      </div>

      <button
        onClick={() => goToSite(inputText)}
        disabled={!inputText.trim()}
        className="w-full text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-pink-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Go to DHCP scopes
      </button>
    </div>
  );
}
