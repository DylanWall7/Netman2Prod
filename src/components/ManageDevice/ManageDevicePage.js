import { useEffect, useRef, useState } from "react";
import { GizmoRequest } from "../../authConfig";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";

import { Button, Autocomplete, AutocompleteItem } from "@nextui-org/react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardIcon,
} from "@heroicons/react/24/solid";
import { useMsal } from "@azure/msal-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [siteLoadError, setSiteLoadError] = useState(null);
  const [deviceLoadError, setDeviceLoadError] = useState(null);

  const url = `https://${process.env.REACT_APP_API_BASEURL}/api/management/netbox/sites/`;
  const GetDevicesURL = `https://${process.env.REACT_APP_API_BASEURL}/api/management/netbox/${siteCodeSelected}/devices/`;

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
        // Full-page redirect, not a popup — this app's redirectUri points at the SPA root,
        // so a popup just loads the whole app inside itself instead of closing. Redirect
        // reuses the already-registered URI (no Azure changes needed) and navigates the tab
        // away, so this never meaningfully returns — the user lands back freshly
        // authenticated and just retries whatever they were doing.
        await instance.acquireTokenRedirect({ ...request, redirectStartPage: window.location.href });
        return null;
      }
      throw error;
    }
  }

  // Guarded with a ref so a re-render mid-redirect (e.g. `inProgress` settling to `None`
  // a tick before `accounts` reflects a just-cached account) can't fire ssoSilent/loginRedirect
  // a second time and bounce the user through two redirect round-trips instead of one.
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
    // No account yet means we're either mid sign-in (the effect above will redirect) or
    // about to be — acquiring a token here too would just fail with no account to use, so
    // wait for an account instead of racing the sign-in flow.
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

  const handleGetDevices = async () => {
    setNetboxLoading(true);
    setGetDeviceData([]);
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
    } catch (err) {
      setDeviceLoadError(err.message || "Failed to load devices — please try again.");
    } finally {
      setNetboxLoading(false);
    }
  };
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  return (
    <>
      <div className=" text-gray-100 flex flex-col items-center">
        <div className="max-w-3xl text-center mt-16">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Manage Devices
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500"></span>
          </h1>
          <p className="text-sm text-pink-400 mb-8">
            Manage individual devices in Netbox.
          </p>
        </div>

        <form className="w-full flex justify-center mb-10">
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

          <div className=" flex justify-center items-center ml-4">
            <Button
              isLoading={netboxLoading}
              onPress={handleGetDevices}
              className="bg-pink-600 "
            >
              Search Devices
            </Button>
          </div>
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
          {(!getDeviceData || getDeviceData.length === 0) && !netboxLoading && !deviceLoadError && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative">
                <div className="text-6xl relative z-10">🚧</div>
              </div>

              <p className="text-gray-400 text-sm max-w-sm">
                Looks like no site is selected — choose one to start managing
                devices.
              </p>

              <div className="mt-4 flex items-center space-x-2 text-xs text-gray-500"></div>
            </div>
          )}

          {getDeviceData.map((siteItem, index) => {
            const site = siteItem.data?.netboxbsite;
            const mist = siteItem.data?.mistsite;
            const devices = siteItem.data?.devices || [];

            return (
              <div
                key={index}
                className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6"
              >
                {/* Site Info */}
                <div className="mb-4 border-b border-gray-800 pb-3 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-semibold text-pink-400">
                      {site?.name || "Unknown Site"}
                    </h2>
                    {/* <p className="text-sm text-gray-500">
                      Region: {site?.region?.name || "N/A"} | Group:{" "}
                      {site?.group?.name || "N/A"}
                    </p> */}
                  </div>
                  <div>
                    {mist ? (
                      <span className="text-green-400 text-sm font-medium">
                        MIST SITE FOUND
                      </span>
                    ) : (
                      <span className="text-red-400 text-sm font-medium">
                        MIST SITE NOT FOUND
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full max-w-md mb-6">
                  <input
                    type="text"
                    placeholder="Search devices by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead className="bg-gray-800 text-gray-300 text-left text-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Device Name</th>
                        <th className="px-4 py-3 font-semibold">IP Address</th>
                        <th className="px-4 py-3 font-semibold">Model</th>
                        <th className="px-4 py-3 font-semibold">Serial</th>
                        <th className="px-4 py-3 font-semibold">Polling</th>
                        <th className="px-4 py-3 font-semibold">Alert</th>

                        <th className="px-4 py-3 font-semibold text-center">
                          Mist Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {devices.length > 0 ? (
                        devices
                          .filter((device) =>
                            device.name
                              ?.toLowerCase()
                              .includes(searchTerm.toLowerCase())
                          )
                          .map((device, idx) => {
                            const inMist =
                              !!device.custom?.mistdevice &&
                              device.custom?.mistdevicesite === mist?.id;
                            const wrongSite =
                              device.custom?.mistdevicesite !== mist?.id &&
                              device.device_type.manufacturer?.name ===
                                "Juniper";

                            return (
                              <tr
                                key={idx}
                                className="hover:bg-gray-800 transition-colors duration-150"
                              >
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
                                      <div className="relative group inline-block">
                                        <span className="text-yellow-400 cursor-pointer pr-3">
                                          {device.serial || "—"}
                                        </span>

                                        <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-max rounded-md bg-gray-800 text-yellow-400 text-md px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg border border-gray-700">
                                          <span>
                                            Device is assigned to the the wrong
                                            site in Mist!
                                          </span>
                                        </div>
                                      </div>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        onPress={() =>
                                          copyToClipboard(device.serial)
                                        }
                                        className="bg-gray-700 text-white "
                                      >
                                        <ClipboardIcon className="w-4 h-4" />
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
                                        onPress={() =>
                                          copyToClipboard(device.serial)
                                        }
                                        className="bg-gray-700 text-white "
                                      >
                                        <ClipboardIcon className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {device.custom_fields?.POLLING === true
                                    ? "Enabled"
                                    : device.custom_fields?.POLLING === false
                                    ? "Disabled"
                                    : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {device.custom_fields?.ALERT || "—"}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {inMist ? (
                                    <CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" />
                                  ) : (
                                    <XCircleIcon className="h-6 w-6 text-red-500 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-6 text-center text-gray-500 italic"
                          >
                            No devices found for this site.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
