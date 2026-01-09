import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import { Input, Button, Checkbox } from "@nextui-org/react";

export default function OpengearReports() {
  const OGReportURL = `https://${process.env.REACT_APP_API_BASEURL}/api/reports/opengear/status`;

  const { instance, accounts } = useMsal();
  const [opengearList, setOpengearList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [filterNotConfigured, setFilterNotConfigured] = useState(false);

  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  useEffect(() => {
    async function fetchOpengearReports({ token }) {
      const headers = new Headers();
      const bearer = `Bearer ${token}`;

      headers.append("Authorization", bearer);
      headers.append("Content-Type", "application/json");

      const options = {
        method: "GET",
        headers: headers,
      };

      return fetch(OGReportURL, options)
        .then(async (response) => {
          let data = await response.json();
          setOpengearList(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error:", error);
          setIsLoading(false);
        });
    }

    (async () => {
      if (accounts.length === 0) return;

      setIsLoading(true);
      try {
        const token = await instance
          .acquireTokenSilent(request)
          .then((response) => response.accessToken);
        await fetchOpengearReports({ token });
      } catch (err) {
        setIsLoading(false);
        console.error({ err });
      }
    })();
  }, [accounts.length]);

  const filteredOpengears = opengearList.filter((og) => {
    // Search filter
    const matchesSearch = og.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Active filter - both connections must be active
    const isActive = og.icmp?.status === 1 && og.snmp?.status === 1;
    const matchesActiveFilter = !filterActive || isActive;

    // Not configured filter - at least one connection is not configured
    const hasNotConfigured = !og.icmp || !og.snmp;
    const matchesNotConfiguredFilter = !filterNotConfigured || hasNotConfigured;

    return matchesSearch && matchesActiveFilter && matchesNotConfiguredFilter;
  });

  const exportToCSV = () => {
    const headers = [
      "Opengear Name",
      "4G Connection Status",
      "4G IP",
      "Wired Connection Status",
      "Wired IP",
    ];

    const rows = filteredOpengears.map((og) => [
      og.name || "Unknown",
      og.icmp
        ? og.icmp.status === 1
          ? "Active"
          : "Inactive"
        : "Not Configured",
      og.icmp?.ip || "No IP",
      og.snmp
        ? og.snmp.status === 1
          ? "Active"
          : "Inactive"
        : "Not Configured",
      og.snmp?.ip || "No IP",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `opengear-report-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StatusDot = ({ status }) => {
    return (
      <div
        className={`w-3 h-3 rounded-full ${
          status === 1 ? "bg-green-500" : "bg-red-500"
        }`}
        title={status === 1 ? "Active" : "Inactive"}
      />
    );
  };

  return (
    <div className="p-6 text-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Opengear Reports
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500"></span>
          </h1>
          <p className="text-sm text-pink-400">
            Monitor Opengear device status for 4G and Wired connections
          </p>
        </div>

        <div className="w-full max-w-4xl mb-6 mx-auto space-y-4">
          <Input
            isClearable
            placeholder="Search by Opengear name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            className="dark"
            variant="bordered"
          />

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Checkbox
              isSelected={filterActive}
              onValueChange={setFilterActive}
              color="success"
              size="sm"
            >
              <span className="text-gray-300 text-sm">Show Active Only</span>
            </Checkbox>

            <Checkbox
              isSelected={filterNotConfigured}
              onValueChange={setFilterNotConfigured}
              color="warning"
              size="sm"
            >
              <span className="text-gray-300 text-sm">Show Not Configured</span>
            </Checkbox>

            <Button
              color="secondary"
              size="sm"
              onPress={exportToCSV}
              isDisabled={filteredOpengears.length === 0}
            >
              Export to CSV
            </Button>
          </div>
        </div>

        {!isLoading && opengearList.length > 0 && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-400">
              {searchTerm ? (
                <>
                  Showing{" "}
                  <span className="text-pink-400 font-semibold">
                    {filteredOpengears.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-pink-400 font-semibold">
                    {opengearList.length}
                  </span>{" "}
                  devices
                </>
              ) : (
                <>
                  Total:{" "}
                  <span className="text-pink-400 font-semibold">
                    {opengearList.length}
                  </span>{" "}
                  devices
                </>
              )}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-pink-400 text-lg">Loading...</div>
          </div>
        ) : filteredOpengears.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-6xl">📡</div>
            <p className="text-gray-400 text-sm max-w-sm">
              {searchTerm
                ? "No Opengear devices match your search"
                : "No Opengear devices found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpengears.map((opengear, index) => (
              <div
                key={index}
                className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6 transition-all duration-300"
              >
                <h3 className="text-lg font-semibold text-pink-400 mb-4 truncate">
                  {opengear.name || "Unknown Opengear"}
                </h3>

                <div className="space-y-4">
                  <div className="border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 text-sm font-medium">
                        4G Connection
                      </span>
                      <div className="flex items-center gap-2">
                        {opengear.icmp ? (
                          <>
                            <StatusDot status={opengear.icmp.status} />
                            <span className="text-sm">
                              {opengear.icmp.status === 1
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-400 text-xs">
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      IP:{" "}
                      {opengear.icmp?.ip ? (
                        opengear.icmp.status === 1 ? (
                          <a
                            href={`https://${opengear.icmp.ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          >
                            {opengear.icmp.ip}
                          </a>
                        ) : (
                          <span className="text-gray-200">
                            {opengear.icmp.ip}
                          </span>
                        )
                      ) : (
                        <span className="text-red-400">No IP</span>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 text-sm font-medium">
                        Wired Connection
                      </span>
                      <div className="flex items-center gap-2">
                        {opengear.snmp ? (
                          <>
                            <StatusDot status={opengear.snmp.status} />
                            <span className="text-sm">
                              {opengear.snmp.status === 1
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-400 text-xs">
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      IP:{" "}
                      {opengear.snmp?.ip ? (
                        opengear.snmp.status === 1 ? (
                          <a
                            href={`https://${opengear.snmp.ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          >
                            {opengear.snmp.ip}
                          </a>
                        ) : (
                          <span className="text-gray-200">
                            {opengear.snmp.ip}
                          </span>
                        )
                      ) : (
                        <span className="text-red-400">No IP</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
