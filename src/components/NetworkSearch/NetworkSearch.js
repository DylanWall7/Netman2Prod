import React, { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import { Input, Button } from "@nextui-org/react";

export default function NetworkSearch() {
  const NetworkSearchURL = `https://${process.env.REACT_APP_API_BASEURL}/api/management/search`;

  const { instance, accounts } = useMsal();
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastSearchedTerm, setLastSearchedTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedOutputs, setExpandedOutputs] = useState({});

  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  const fetchSearchResults = async ({ token, query }) => {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "GET",
      headers: headers,
    };

    return fetch(
      `${NetworkSearchURL}?search=${encodeURIComponent(query)}`,
      options
    )
      .then(async (response) => {
        let data = await response.json();
        setSearchResults(data);
        setIsLoading(false);
        setHasSearched(true);
      })
      .catch((error) => {
        console.error("Error:", error);
        setIsLoading(false);
        setHasSearched(true);
      });
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || accounts.length === 0) return;

    setIsLoading(true);
    setHasSearched(false);
    setExpandedOutputs({});
    setLastSearchedTerm(searchTerm);
    try {
      const token = await instance
        .acquireTokenSilent(request)
        .then((response) => response.accessToken);
      await fetchSearchResults({ token, query: searchTerm });
    } catch (err) {
      setIsLoading(false);
      setHasSearched(true);
      console.error({ err });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleOutput = (resultId, outputIdx) => {
    const key = `${resultId}-${outputIdx}`;
    setExpandedOutputs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const highlightText = (text, searchTerm) => {
    if (!text || !searchTerm) return text;

    const textStr = String(text);
    const searchStr = String(searchTerm);
    const regex = new RegExp(`(${searchStr})`, "gi");
    const parts = textStr.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-400 text-gray-900 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="p-6 text-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Network Search
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500"></span>
          </h1>
          <p className="text-sm text-pink-400">
            Search the network for devices and information
          </p>
        </div>

        <div className="w-full max-w-xl mb-6 mx-auto">
          <div className="flex gap-2">
            <Input
              isClearable
              placeholder="Search for anything in the network..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => {
                setSearchTerm("");
              }}
              onKeyDown={handleKeyDown}
              className="dark"
              variant="bordered"
            />
            <Button
              color="primary"
              onPress={handleSearch}
              isLoading={isLoading}
              isDisabled={searchTerm.trim().length < 7}
            >
              Search
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <style>{`.spinner_S1WN{animation:spinner_MGfb .8s linear infinite;animation-delay:-.8s}.spinner_Km9P{animation-delay:-.65s}.spinner_JApP{animation-delay:-.5s}@keyframes spinner_MGfb{93.75%,100%{opacity:.2}}`}</style>
              <circle
                className="spinner_S1WN"
                cx="4"
                cy="12"
                r="3"
                fill="#3bd6ce"
              />
              <circle
                className="spinner_S1WN spinner_Km9P"
                cx="12"
                cy="12"
                r="3"
                fill="#3bd6ce"
              />
              <circle
                className="spinner_S1WN spinner_JApP"
                cx="20"
                cy="12"
                r="3"
                fill="#3bd6ce"
              />
            </svg>
          </div>
        ) : hasSearched && searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <p className="text-gray-400 text-sm max-w-sm">
              No results found for "{lastSearchedTerm}"
            </p>
          </div>
        ) : hasSearched && searchResults.length > 0 ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-400 mb-4">
              Found {searchResults.length} result
              {searchResults.length !== 1 ? "s" : ""}
            </div>
            {searchResults.map((result, index) => (
              <div
                key={result.id || index}
                className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 hover:border-pink-500 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-pink-400 mb-1">
                      {highlightText(result.name, searchTerm)}
                    </h3>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded">
                        {highlightText(
                          result.role?.replace(/_/g, " "),
                          searchTerm
                        )}
                      </span>
                      <span className="text-xs px-2 py-1 bg-purple-900/50 text-purple-300 rounded">
                        {highlightText(result.model, searchTerm)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      IP Address
                    </div>
                    <div className="text-sm font-mono text-gray-200">
                      {highlightText(result.ip || "N/A", searchTerm)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Site
                    </div>
                    <div className="text-sm font-semibold text-gray-200">
                      {highlightText(result.site || "N/A", searchTerm)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Location
                    </div>
                    <div className="text-sm text-gray-200">
                      {highlightText(result.location || "N/A", searchTerm)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Netbox ID
                    </div>
                    <div className="text-sm font-mono text-gray-200">
                      {highlightText(String(result.id), searchTerm)}
                    </div>
                  </div>
                </div>

                {result.outputs && result.outputs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      Additional Information
                    </div>
                    {result.outputs.map((output, idx) => {
                      const key = `${result.id}-${idx}`;
                      const isExpanded = expandedOutputs[key] || false;
                      return (
                        <div key={idx} className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-pink-400 font-semibold">
                              {output.type?.replace(/_/g, " ").toUpperCase()}
                            </div>
                            {output.data && (
                              <button
                                onClick={() => toggleOutput(result.id, idx)}
                                className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors duration-150"
                              >
                                {isExpanded ? "Hide Details" : "Show Details"}
                              </button>
                            )}
                          </div>
                          {output.data && isExpanded && (
                            <pre className="text-xs text-gray-300 bg-gray-900/50 p-3 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                              {highlightText(
                                typeof output.data === "string"
                                  ? output.data
                                  : JSON.stringify(output.data, null, 2),
                                searchTerm
                              )}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
