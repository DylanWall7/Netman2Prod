import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import {
  Input,
  Button,
  Checkbox,
  Pagination,
  Select,
  SelectItem,
} from "@nextui-org/react";

export default function OpengearReports() {
  const OGReportURL = `https://${process.env.REACT_APP_API_BASEURL}/api/reports/opengear/status`;

  const { instance, accounts } = useMsal();
  const [opengearList, setOpengearList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [filterNotConfigured, setFilterNotConfigured] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  const fetchOpengearReports = async ({ token }) => {
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
  };

  const handleRefresh = async () => {
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
  };

  useEffect(() => {
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
    const matchesSearch = og.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    const isActive = og.icmp?.status === 1 && og.snmp?.status === 1;
    const matchesActiveFilter = !filterActive || isActive;

    const hasNotConfigured = !og.icmp || !og.snmp;
    const matchesNotConfiguredFilter = !filterNotConfigured || hasNotConfigured;

    return matchesSearch && matchesActiveFilter && matchesNotConfiguredFilter;
  });

  const totalPages = Math.ceil(filteredOpengears.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredOpengears.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterActive, filterNotConfigured, itemsPerPage]);

  const itemsPerPageOptions = [
    { key: "50", label: "50" },
    { key: "100", label: "100" },
    { key: "500", label: "500" },
    { key: "1000", label: "1000" },
  ];

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

            <Select
              label="Items per page"
              size="sm"
              selectedKeys={[String(itemsPerPage)]}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="dark max-w-xs"
              variant="bordered"
            >
              {itemsPerPageOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>

            <Button
              color="secondary"
              size="sm"
              onPress={exportToCSV}
              isDisabled={filteredOpengears.length === 0}
            >
              Export to CSV
            </Button>

            <Button
              color="primary"
              size="sm"
              onPress={handleRefresh}
              isLoading={isLoading}
              isIconOnly
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </Button>
          </div>
        </div>

        {!isLoading && opengearList.length > 0 && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-400">
              {searchTerm || filterActive || filterNotConfigured ? (
                <>
                  Showing{" "}
                  <span className="text-pink-400 font-semibold">
                    {startIndex + 1}-
                    {Math.min(endIndex, filteredOpengears.length)}
                  </span>{" "}
                  of{" "}
                  <span className="text-pink-400 font-semibold">
                    {filteredOpengears.length}
                  </span>{" "}
                  filtered devices (
                  <span className="text-pink-400 font-semibold">
                    {opengearList.length}
                  </span>{" "}
                  total)
                </>
              ) : (
                <>
                  Showing{" "}
                  <span className="text-pink-400 font-semibold">
                    {startIndex + 1}-{Math.min(endIndex, opengearList.length)}
                  </span>{" "}
                  of{" "}
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
          <div className="border-pink-200 border-large rounded-lg overflow-hidden">
            <div className="bg-pink-300 px-6 py-3 border-b border-pink-200">
              <div className="grid grid-cols-10 gap-1 text-xs font-semibold text-pink-400 uppercase tracking-wider">
                <div className="col-span-3">Device Name</div>
                <div className="col-span-2">4G Connection</div>
                <div className="col-span-2">4G IP Address</div>
                <div className="col-span-2">Wired Connection</div>
                <div className="col-span-1">Wired IP</div>
              </div>
            </div>

            <div className="divide-y divide-pink-200">
              {currentItems.map((opengear, index) => (
                <div
                  key={index}
                  className="bg-pink-300 px-6 py-4 hover:bg-pink-700 transition-colors duration-150"
                >
                  <div className="grid grid-cols-10 gap-2 items-center">
                    <div className="col-span-3">
                      <h3 className="text-base font-semibold text-pink-400 truncate">
                        {opengear.name || "Unknown Opengear"}
                      </h3>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {opengear.icmp ? (
                          <>
                            <StatusDot status={opengear.icmp.status} />
                            <span className="text-sm text-pink-400">
                              {opengear.icmp.status === 1
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-400 text-sm">
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2">
                      {opengear.icmp?.ip ? (
                        opengear.icmp.status === 1 ? (
                          <a
                            href={`https://${opengear.icmp.ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline text-sm"
                          >
                            {opengear.icmp.ip}
                          </a>
                        ) : (
                          <span className="text-pink-400 text-sm">
                            {opengear.icmp.ip}
                          </span>
                        )
                      ) : (
                        <span className="text-red-400 text-sm">No IP</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {opengear.snmp ? (
                          <>
                            <StatusDot status={opengear.snmp.status} />
                            <span className="text-sm text-pink-400">
                              {opengear.snmp.status === 1
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-400 text-sm">
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-1">
                      {opengear.snmp?.ip ? (
                        opengear.snmp.status === 1 ? (
                          <a
                            href={`https://${opengear.snmp.ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline text-sm"
                          >
                            {opengear.snmp.ip}
                          </a>
                        ) : (
                          <span className="text-pink-400 text-sm">
                            {opengear.snmp.ip}
                          </span>
                        )
                      ) : (
                        <span className="text-red-400 text-sm">No IP</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && filteredOpengears.length > 0 && totalPages > 1 && (
          <div className="flex justify-center mt-6 dark">
            <Pagination
              total={totalPages}
              page={currentPage}
              onChange={setCurrentPage}
              showControls
              color="secondary"
              size="lg"
              classNames={{
                cursor: "bg-pink-500 text-white",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
