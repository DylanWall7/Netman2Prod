import React from "react";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {
  Input,
  Button,
  Autocomplete,
  AutocompleteItem,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { GizmoRequest } from "../../authConfig";
import { useForm } from "react-hook-form";

export const ProvAccordian = () => {
  const [dhcpSite, setDHCPSite] = React.useState("");
  const [createNetbox, setCreateNetbox] = React.useState("");
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = React.useState(false);
  const [siteCodeSelected, setSiteCodeSelected] = React.useState(new Set([]));
  const [isSiteFullySelected, setIsSiteFullySelected] = React.useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [siteList, setSiteList] = useState([]);
  const [postStatus, setPostStatus] = useState("");
  const [validation, setValidation] = useState([]);
  const [validateLoading, setValidateLoading] = React.useState(false);
  const [dhcpLoading, setDhcpLoading] = React.useState("");
  const [mistLoading, setMistLoading] = React.useState("");
  const [vlan1, setVlan1] = React.useState([]);
  const [vlan5, setVlan5] = React.useState([]);
  const [vlan9, setVlan9] = React.useState([]);
  const [vlan13, setVlan13] = React.useState([]);
  const [dhcpStatus, setDhcpStatus] = React.useState("");
  const [deployLoading, setDeployLoading] = React.useState(false);
  const [modelList, setModelList] = React.useState([]);
  const [netboxLoading, setNetboxLoading] = useState(false);
  const [template, setTemplate] = React.useState(new Set([]));
  const [skeletonLoading, setSkeletonLoading] = React.useState(false);
  const [netboxToMistLoading, setNetboxToMistLoading] = React.useState(false);
  const [availableIps, setAvailableIps] = useState([]);
  const [ipIndex, setIpIndex] = useState(0);
  const [nextIpLoading, setNextIpLoading] = React.useState(false);
  const [logsCopied, setLogsCopied] = React.useState(false);
  const [logFilter, setLogFilter] = React.useState(null);
  const [resultKey, setResultKey] = React.useState(0);
  const [csvLimitWarning, setCsvLimitWarning] = React.useState(false);

  const [dhcpData, setDhcpData] = useState({ status: null, logs: {} });
  const [fillIpData, setFillIpData] = useState({
    status: null,
    log: [],
  });

  const {
    register: registerDHCP,
    handleSubmit: handleSubmitDHCP,
    setValue,
    formState: { touched },
  } = useForm({
    defaultValues: {
      siteDHCP: "",
    },
  });
  const {
    register: registerMist,
    handleSubmit: handleSubmitMist,
    setValue: setValueMist,
    formState: { touchedMist },
  } = useForm({
    defaultValues: {
      siteMist: "",
    },
  });

  const url = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/snowlocations`;
  const NetboxURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCodeSelected}`;
  const ValidateURL = `https://${process.env.REACT_APP_API_BASEURL}/api/validation/netboxsite/${siteCodeSelected}`;
  const vlan1URL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/dhcp/${siteCodeSelected}/vlan/1`;
  const vlan5URL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/dhcp/${siteCodeSelected}/vlan/5`;
  const vlan9URL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/dhcp/${siteCodeSelected}/vlan/9`;
  const vlan13URL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/dhcp/${siteCodeSelected}/vlan/13`;
  const CreateMistURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/mist/site/${siteCodeSelected}`;
  const DeployDeviceURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCodeSelected}/devices`;
  const netboxtomistURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/mist/site/${siteCodeSelected}/devices`;
  const ModelURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netbox/devicetypes`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };
  const [siteLoadError, setSiteLoadError] = useState(null);

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

  function resetforms() {
    setValidation([]);
    setPostStatus("");
    setDhcpStatus("");
    setVlan1([]);
    setVlan5([]);
    setVlan9([]);
    setVlan13([]);
    setDhcpData({ status: null, logs: {} });
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setSiteLoadError(null);
      try {
        const token = await getToken();
        GetAllSites({ token });
      } catch (err) {
        setIsLoading(false);
        setSiteLoadError(err.message || "Failed to load sites — please try again.");
      }
    })();
  }, [accounts.length === 0]);

  const handleAddNetbox = async () => {
    resetforms();
    setNetboxLoading(true);
    setSkeletonLoading(true);
    try {
      const token = await getToken();
      CreateNetbox({ token });
    } catch (err) {
      setNetboxLoading(false);
      setSkeletonLoading(false);
      setPostStatus(0);
      setCreateNetbox([{ msg: err.message || "Authentication failed." }]);
    }
  };
  const handleNetboxMistPush = async () => {
    resetforms();
    setNetboxToMistLoading(true);
    setSkeletonLoading(true);
    try {
      const token = await getToken();
      PushDevicesFromNetboxToMist({ token });
    } catch (err) {
      setNetboxToMistLoading(false);
      setSkeletonLoading(false);
      setPostStatus(0);
      setCreateNetbox([{ msg: err.message || "Authentication failed." }]);
    }
  };
  const handleValidate = async () => {
    setValidateLoading(true);
    setPostStatus([]);
    setDhcpStatus([]);
    try {
      const token = await getToken();
      ValidateSite({ token });
    } catch (err) {
      setValidateLoading(false);
      setPostStatus(0);
      setCreateNetbox([{ msg: err.message || "Authentication failed." }]);
    }
  };
  const handleDHCP = async () => {
    resetforms();
    setDhcpLoading(true);
    setSkeletonLoading(true);
    try {
      await CreatDHCPAllVlan({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      setDhcpLoading(false);
      setSkeletonLoading(false);
      setLoading(false);
    }
  };
  const handleCreateMist = async () => {
    resetforms();
    setMistLoading(true);
    setSkeletonLoading(true);
    try {
      await CreateMistSite({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      setDhcpLoading(false);
      setMistLoading(false);
      setSkeletonLoading(false);
      setLoading(false);
    }
  };
  const handleDeployDevice = async () => {
    resetforms();
    setDeployLoading(true);
    setSkeletonLoading(true);
    try {
      await DeplyDevicetoNetbox({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      setDhcpLoading(false);
      setDeployLoading(false);
      setSkeletonLoading(false);
      setLoading(false);
    }
  };
  const handleGetAvailableIps = async () => {
    if (availableIps && availableIps.length > 0) {
      return availableIps;
    }
    setNextIpLoading(true);

    try {
      const token = await instance
        .acquireTokenSilent(request)
        .then((response) => {
          return response.accessToken;
        });

      return await GetAvailableIps({ token });
    } catch (err) {
      setNextIpLoading(false);
      setLoading(false);
      return [];
    }
  };
  async function GetAllSites({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "GET",
      headers: headers,
    };

    return fetch(url, options)
      .then(async (response) => {
        let text = await response.json();

        setSiteList(text);
        setIsLoading(false);
      })
      .then(() => {
        fetch(ModelURL, options)
          .then(async (response) => {
            let text = await response.json();

            setModelList(text);
          })
          .catch((error) => {
            console.error("Error fetching device types:", error);
          });
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
      });
  }

  React.useEffect(() => {
    if (siteCodeSelected) {
      setDHCPSite(siteCodeSelected);
    }
  }, [siteCodeSelected]);

  async function CreateNetbox({ token }) {
    setPostStatus("");
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "POST",

      headers: headers,
    };

    return fetch(NetboxURL, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Create Netbox site failed (${response.status})`);
        let netboxPostResponse = await response.json();

        setCreateNetbox(netboxPostResponse?.log);
        setPostStatus(netboxPostResponse?.status);
        setResultKey((k) => k + 1);
        setIsLoading(false);
        setNetboxLoading(false);
        setSkeletonLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setNetboxLoading(false);
        setSkeletonLoading(false);
      });
  }
  async function CreateMistSite({ token }) {
    setPostStatus("");
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "POST",
      body: JSON.stringify({
        gateway_template: [...template][0],
      }),
      headers: headers,
    };

    return fetch(CreateMistURL, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Create Mist site failed (${response.status})`);
        let mistPostResponse = await response.json();

        setCreateNetbox(mistPostResponse?.log);
        setPostStatus(mistPostResponse?.status);
        setResultKey((k) => k + 1);
        setSkeletonLoading(false);
        setMistLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setMistLoading(false);
        setSkeletonLoading(false);
        setLoading(false);
      });
  }
  async function DeplyDevicetoNetbox({ token }) {
    setPostStatus("");
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "POST",
      body: JSON.stringify(devices),

      headers: headers,
    };

    return fetch(DeployDeviceURL, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Deploy devices failed (${response.status})`);
        let DeployDevicePostResponse = await response.json();

        setCreateNetbox(DeployDevicePostResponse?.log);
        setPostStatus(DeployDevicePostResponse?.status);
        setResultKey((k) => k + 1);
        setSkeletonLoading(false);
        setDeployLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setDeployLoading(false);
        setSkeletonLoading(false);
        setLoading(false);
      });
  }
  async function ValidateSite({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "GET",

      headers: headers,
    };

    return fetch(ValidateURL, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Validate site failed (${response.status})`);
        let validateGetResponce = await response.json();

        setValidation(validateGetResponce.log);

        setIsLoading(false);
        setValidateLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setValidateLoading(false);
      });
  }
  async function CreatDHCPAllVlan({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;
    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");
    const options = { method: "POST", headers: headers };
    const allresponses = await Promise.all([
      fetch(vlan1URL, options),
      fetch(vlan5URL, options),
      fetch(vlan9URL, options),
      fetch(vlan13URL, options),
    ]).catch((error) => { console.error("Error:", error); setLoading(false); });
    for (const res of allresponses) {
      if (!res.ok) throw new Error(`DHCP request failed (${res.status})`);
    }
    const data = await Promise.all(allresponses.map((response) => response.json()));
    const vlanKeys = ["vlan1", "vlan5", "vlan9", "vlan13"];
    const logs = vlanKeys.reduce((acc, key, i) => { acc[key] = data[i].log || []; return acc; }, {});
    setDhcpData({ status: data[0].status, logs });
    const allLogs = vlanKeys.flatMap((key, i) => data[i].log || []);
    const overallStatus = data.some((d) => d.status === 0) ? 0 : 1;
    setPostStatus(overallStatus);
    setCreateNetbox(allLogs);
    setResultKey((k) => k + 1);
    setDhcpLoading(false);
    setSkeletonLoading(false);
    setLoading(false);
  }
  async function PushDevicesFromNetboxToMist({ token }) {
    setPostStatus("");
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "POST",

      headers: headers,
    };

    return fetch(netboxtomistURL, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Push to Mist failed (${response.status})`);
        let netboxPostResponse = await response.json();

        setCreateNetbox(netboxPostResponse?.log);
        setPostStatus(netboxPostResponse?.status);
        setResultKey((k) => k + 1);
        setIsLoading(false);
        setNetboxToMistLoading(false);
        setSkeletonLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setNetboxToMistLoading(false);
        setSkeletonLoading(false);
      });
  }

  async function GetAvailableIps({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = { method: "GET", headers };

    try {
      const response = await fetch(nextIPURL, options);
      const nextipList = await response.json();

      setNextIpLoading(false);

      setAvailableIps(nextipList.data?.switches || []);

      return nextipList;
    } catch (error) {
      console.error("Error:", error);
      setNextIpLoading(false);
      setLoading(false);
      return {
        status: 0,
        log: [{ msg: "Failed to fetch available IPs" }],
        data: { routers: [], switches: [] },
      };
    }
  }

  const Templates = [
    { key: "V102_SRX3XX_INTERNET", label: "V102_SRX3XX_INTERNET" },
    { key: "V102_SRX3XX_DUAL_INTERNET", label: "V102_SRX3XX_DUAL_INTERNET" },
    { key: "V102_SRX3XX_KPN", label: "V102_SRX3XX_KPN" },
    { key: "V102_SRX3XX_KPN_INET", label: "V102_SRX3XX_KPN_INET" },
  ];
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
      const rows = text
        .split("\n")
        .map((row) => row.trim())
        .filter(Boolean);

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

      const limitedDevices = parsedDevices.slice(0, 20);
      if (parsedDevices.length > 20) setCsvLimitWarning(true);

      setDevices((prev) => [...prev, ...limitedDevices]);
    };
    reader.readAsText(file);
  };

  const RedTrashIcon = ({ size = 24, ...props }) => (
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
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v18M3 12h18"
      />
    </svg>
  );

  const [accordionKeys, setAccordionKeys] = React.useState(new Set([]));

  useEffect(() => {
    if (isSiteFullySelected) {
      setAccordionKeys(new Set(["1"]));
    } else {
      setAccordionKeys(new Set([]));
    }
  }, [isSiteFullySelected]);

  const itemClasses = {
    base: "py-0 w-full border rounded border-pink-200",
    title: "font-normal text-medium text-pink-400",
    trigger:
      "px-2 py-0 data-[hover=true]:bg-pink-300 rounded-lg h-14 flex items-center",
    indicator: "text-medium",
    content: "text-small px-2",
  };

  const [devices, setDevices] = React.useState([
    { serial: "", name: "", model: "", ip: "", oob_ip: "" },
  ]);

  const [dragState, setDragState] = React.useState({
    active: false,
    field: null,
    fromIndex: null,
    toIndex: null,
  });
  const dragStateRef = React.useRef(dragState);
  dragStateRef.current = dragState;

  const handleInputChange = (index, event) => {
    const values = [...devices];
    values[index][event.target.name] = event.target.value;
    setDevices(values);
  };
  const handleFillIPs = async () => {
    resetforms();
    setFillIpData({ status: null, log: [] });
    const response = await handleGetAvailableIps();

    if (response?.status === 0) {
      setCreateNetbox(response?.log);
      setPostStatus(response?.status);
      setResultKey((k) => k + 1);
      return;
    }

    const ipData = response?.data;
    setFillIpData({ status: response?.status, log: response?.log || [] });

    setDevices((prevDevices) => {
      const usedIps = prevDevices.map((d) => d.ip).filter(Boolean);

      let routerIps =
        ipData?.routers?.filter((ip) => !usedIps.includes(ip)) || [];
      let switchIps =
        ipData?.switches?.filter((ip) => !usedIps.includes(ip)) || [];

      const updated = prevDevices.map((device) => {
        if (!device.ip) {
          if (device.model?.startsWith("SRX")) {
            const ip = routerIps.shift();
            return ip ? { ...device, ip } : device;
          }

          if (
            (/^.*_0$/.test(device.name ?? "") ||
              !/_\d+$/.test(device.name ?? "")) &&
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
    setDevices((prevDevices) => {
      const usedIps = prevDevices.map((d) => d?.ip).filter(Boolean);
      setAvailableIps((prevIps) => [...prevIps, ...usedIps]);
      return prevDevices.map((d) => ({ ...d, ip: "", oob_ip: "" }));
    });
    setAvailableIps([]);
  };

  const handleAddDevice = () => {
    if (devices?.length >= 20) return;
    setDevices([
      ...devices,
      { serial: "", name: "", model: "", ip: "", oob_ip: "" },
    ]);
  };

  const handleRemoveDevice = (index) => {
    setDevices((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ serial: "", name: "", model: "", ip: "", oob_ip: "" }];
    });
  };

  function incrementName(name, offset) {
    const match = name.match(/^(.*?)(\d+)$/);
    if (!match) return name;
    const [, prefix, numStr] = match;
    const next = (parseInt(numStr, 10) + offset)
      .toString()
      .padStart(numStr.length, "0");
    return prefix + next;
  }

  useEffect(() => {
    const handleMouseUp = () => {
      const ds = dragStateRef.current;
      if (!ds.active) return;
      if (
        ds.fromIndex !== null &&
        ds.toIndex !== null &&
        ds.fromIndex !== ds.toIndex
      ) {
        const { field, fromIndex, toIndex } = ds;
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        setDevices((prev) => {
          const updated = [...prev];
          const sourceValue = updated[fromIndex]?.[field] ?? "";
          const existingEnd = Math.min(end, prev.length - 1);
          const newRowCount = Math.min(Math.max(0, end - (prev.length - 1)), 20 - prev.length);
          for (let i = start; i <= existingEnd; i++) {
            if (i === fromIndex) continue;
            if (field === "name") {
              updated[i] = {
                ...updated[i],
                name: incrementName(sourceValue, i - fromIndex),
              };
            } else {
              updated[i] = { ...updated[i], [field]: sourceValue };
            }
          }
          for (let i = 0; i < newRowCount; i++) {
            const offset = prev.length + i - fromIndex;
            const newRow = { serial: "", name: "", model: "", ip: "", oob_ip: "" };
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

  const nextIPURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCodeSelected}/addresses/${devices?.length}`;

  const validateGoodIcon = (
    <svg
      xmlns="http://www.w3.org/
            2000/svg"
      className="h-6 w-6 text-green-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
  const validateBadIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-red-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );

  const hasACM = devices.some((d) => d.model?.startsWith("ACM"));
  const gridCols = hasACM
    ? "grid-cols-[2rem_1.5fr_1.5fr_1.5fr_1fr_1fr_2.5rem]"
    : "grid-cols-[2rem_1.5fr_1.5fr_1.5fr_1fr_2.5rem]";

  return (
    <>
      <div className="  text-lg flex flex-col justify-center items-center">
        <div className="">
          <div className="  ml-5">
            <div className="max-w-3xl mx-auto text-center mt-16">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
                  Provision Wizard
                </span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-pink-500"></span>
              </h1>
              <p className="text-sm text-pink-400 mb-8">
                Select a site to get started.
              </p>
              <div className="dark text-foreground flex justify-center">
                <Autocomplete
                  size="sm"
                  label="Site Code (From ServiceNow)"
                  menuTrigger="input"
                  placeholder="Site Code"
                  className="max-w-sm text-pink-400"
                  variant="bordered"
                  isLoading={isLoading}
                  onSelectionChange={(key) => {
                    setSiteCodeSelected(key ?? "");
                    setIsSiteFullySelected(!!key);
                  }}
                  onInputChange={(value) => {
                    if (!value) {
                      setSiteCodeSelected("");
                      setIsSiteFullySelected(false);
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
        </div>

        <div className="mt-12">
          <div className="flex flex-col justify-start ml-5">
            <Accordion
              itemClasses={itemClasses}
              keepContentMounted={true}
              selectedKeys={accordionKeys}
              onSelectionChange={setAccordionKeys}
            >
              <AccordionItem
                key="1"
                aria-label="Accordion 1"
                title="Step 1: Create Site in Netbox"
                className="text-pink-400"
                isDisabled={!isSiteFullySelected}
              >
                <div className="  text-lg  ">
                  <div className="flex justify-start">
                    <div className="flex justify-start ml-5"></div>
                  </div>
                  <div className="mt-6">
                    <form className="w-full flex justify-center">
                      <div className="border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 w-3/4">
                        <div className="p-2 dark text-foreground">
                          <Input
                            size="sm"
                            label="Selected Site"
                            className="max-w-lg"
                            variant="bordered"
                            value={siteCodeSelected}
                            isReadOnly
                          />
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            isLoading={netboxLoading}
                            onPress={handleSubmit(handleAddNetbox)}
                            className="bg-pink-600"
                          >
                            Add Site
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                key="2"
                aria-label="Accordion 2"
                title="Step 2: Deploy DHCP"
                isDisabled={!isSiteFullySelected}
              >
                <div className="  text-lg  ">
                  <div className="  mt-6 ">
                    <form className="w-Full flex justify-center">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 w-3/4 ">
                        <div className="p-2 dark text-foreground bg-transparent ">
                          <Input
                            size="sm"
                            label="Selected Site"
                            className="max-w-lg"
                            placeholder="Site Description"
                            variant="bordered"
                            value={siteCodeSelected}
                            isDisabled={!isSiteFullySelected}
                          />
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            onPress={handleDHCP}
                            onPressStart={() => setValue("siteDHCP", siteCodeSelected)}
                            className="bg-pink-600"
                            isLoading={dhcpLoading}
                          >
                            Deploy DHCP
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                isDisabled={!isSiteFullySelected}
                key="3"
                aria-label="Accordion 3"
                title="Step 3: Deploy Site to Mist"
              >
                <div className="  text-lg  ">
                  <div className=" flex justify-center mt-6 ">
                    <form className="w-full flex justify-center">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 w-3/4 ">
                        <div className="p-2 dark text-foreground bg-transparent ">
                          <Input
                            size="sm"
                            label="Selected Site"
                            className="max-w-lg"
                            variant="bordered"
                            placeholder="Site Description"
                            value={siteCodeSelected}
                            isDisabled={
                              !isSiteFullySelected
                            }
                            {...registerMist("siteMist")}
                          />
                          <div className="p-3" />
                          <Select
                            isRequired
                            size="sm"
                            label="SRX Template"
                            selectedKeys={template}
                            placeholder="Select a Template"
                            onSelectionChange={setTemplate}
                            className="max-w-sm text-pink-400"
                            variant="bordered"
                          >
                            {Templates.map((template) => (
                              <SelectItem key={template.key}>
                                {template.label}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>

                        <div className=" p-2 ">
                          <div className="dark text-foreground bg-background-pink-300 "></div>
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            isLoading={mistLoading}
                            onPress={handleSubmit(handleCreateMist)}
                            className="bg-pink-600 "
                          >
                            Add Site
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                key="4"
                aria-label="Accordion 4"
                title="Step 4: Deploy Devices to Netbox"
                isDisabled={!isSiteFullySelected}
              >
                <div className="  text-lg  ">
                  <div className=" flex justify-left mt-6 ">
                    <form className="w-full">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 ">
                        <div className="p-2 dark text-foreground bg-transparent ">
                          <div className=" ">
                            <div className="px-2 py-2 flex items-center justify-between">
                              <span className="text-xs text-pink-400 tracking-wider uppercase font-medium select-none">Device Assign List</span>
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
                                <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  Download CSV Template
                                </div>
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-zinc-600/60">
                              {/* Table header */}
                              <div className={`grid ${gridCols} bg-zinc-800/70 border-b border-zinc-600/60 text-xs uppercase tracking-wider text-zinc-400 font-semibold select-none`}>
                                <div className="flex items-center justify-center py-2 border-r border-zinc-600/40">#</div>
                                <div className="flex items-center px-2 py-2 border-r border-zinc-600/40">Serial</div>
                                <div className="flex items-center px-2 py-2 border-r border-zinc-600/40">Name</div>
                                <div className="flex items-center px-2 py-2 border-r border-zinc-600/40">Model</div>
                                <div className="flex items-center px-2 py-2 border-r border-zinc-600/40">IP</div>
                                {hasACM && <div className="flex items-center px-2 py-2 border-r border-zinc-600/40">OOB IP</div>}
                                <div className="py-2" />
                              </div>
                              {/* Device rows */}
                              {devices.map((device, index) => (
                                <div
                                  key={index}
                                  className={`grid ${gridCols} border-b border-zinc-700/40 h-10 transition-colors ${
                                    dragState.active &&
                                    index !== dragState.fromIndex &&
                                    index >= Math.min(dragState.fromIndex, Math.min(dragState.toIndex, devices.length - 1)) &&
                                    index <= Math.max(dragState.fromIndex, Math.min(dragState.toIndex, devices.length - 1))
                                      ? "bg-pink-400/15 ring-1 ring-inset ring-pink-400"
                                      : "hover:bg-zinc-800/20"
                                  }`}
                                  onMouseMove={() => {
                                    if (dragState.active && dragState.toIndex !== index) {
                                      setDragState((prev) => ({ ...prev, toIndex: index }));
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-center text-xs text-zinc-500 border-r border-zinc-700/40 select-none">
                                    {index + 1}
                                  </div>
                                  <div className="relative border-r border-zinc-700/40 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                                    <input
                                      type="text"
                                      name="serial"
                                      value={device.serial}
                                      onChange={(event) => handleInputChange(index, event)}
                                      placeholder="Serial Number"
                                      className="w-full h-full px-2 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                                    />
                                  </div>
                                  <div className="relative border-r border-zinc-700/40 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                                    <input
                                      type="text"
                                      name="name"
                                      value={device.name}
                                      onChange={(event) => handleInputChange(index, event)}
                                      placeholder="Device Name"
                                      className="w-full h-full px-2 pr-4 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
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
                                  <div className="dark relative border-r border-zinc-700/40">
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
                                        input: "text-sm text-zinc-100 placeholder:text-zinc-500 pl-2 py-0",
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
                                  <div className="relative border-r border-zinc-700/40 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                                    <input
                                      type="text"
                                      name="ip"
                                      value={device.ip}
                                      disabled={device.model?.startsWith("AP")}
                                      onChange={(event) => handleInputChange(index, event)}
                                      placeholder="IP Address"
                                      className="w-full h-full px-2 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  {hasACM && (
                                    <div className="relative border-r border-zinc-700/40 focus-within:bg-pink-400/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-pink-400">
                                      {device.model?.startsWith("ACM") && (
                                        <input
                                          type="text"
                                          name="oob_ip"
                                          value={device.oob_ip}
                                          onChange={(event) => handleInputChange(index, event)}
                                          placeholder="4G OOB IP"
                                          className="w-full h-full px-2 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                                        />
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-center">
                                    <Button
                                      onPress={() => handleRemoveDevice(index)}
                                      isIconOnly
                                      variant="light"
                                      size="sm"
                                    >
                                      <RedTrashIcon size={16} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {/* Ghost rows — shown while dragging to preview new rows */}
                              {dragState.active && devices.length < 20 && (
                                Array.from({ length: 20 - devices.length }).map((_, i) => {
                                  const ghostIndex = devices.length + i;
                                  const isActive = ghostIndex <= dragState.toIndex;
                                  const sourceValue = devices[dragState.fromIndex]?.[dragState.field] ?? "";
                                  const previewValue = dragState.field === "name"
                                    ? incrementName(sourceValue, ghostIndex - dragState.fromIndex)
                                    : sourceValue;
                                  return (
                                    <div
                                      key={`ghost-${ghostIndex}`}
                                      className={`grid ${gridCols} border-b border-dashed h-10 transition-colors ${
                                        isActive
                                          ? "border-pink-400/50 bg-pink-400/10"
                                          : "border-zinc-600/20 opacity-20"
                                      }`}
                                      onMouseMove={() => {
                                        if (dragState.active) {
                                          setDragState((prev) => ({ ...prev, toIndex: ghostIndex }));
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-center text-xs text-zinc-500 border-r border-dashed border-zinc-600/30 select-none">
                                        {ghostIndex + 1}
                                      </div>
                                      <div className="border-r border-dashed border-zinc-600/30" />
                                      <div className={`border-r border-dashed border-zinc-600/30 flex items-center px-2 text-xs italic ${isActive ? "text-pink-800" : ""}`}>
                                        {dragState.field === "name" ? previewValue : ""}
                                      </div>
                                      <div className={`border-r border-dashed border-zinc-600/30 flex items-center px-2 text-xs italic ${isActive ? "text-pink-800" : ""}`}>
                                        {dragState.field === "model" ? previewValue : ""}
                                      </div>
                                      <div className="border-r border-dashed border-zinc-600/30" />
                                      {hasACM && <div className="border-r border-dashed border-zinc-600/30" />}
                                      <div />
                                    </div>
                                  );
                                })
                              )}
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
                                        id="csvUpload"
                                        className="hidden"
                                        onChange={handleImportCSV}
                                      />
                                      <Button
                                        onPress={() => document.getElementById("csvUpload").click()}
                                        size="sm"
                                        variant="bordered"
                                        className="border-sky-500/60 text-sky-400 hover:border-sky-400 hover:bg-sky-400/10 rounded-md text-xs transition-colors"
                                      >
                                        Import CSV
                                      </Button>
                                      <Button
                                        onPress={() => {
                                          setDevices([{ serial: "", name: "", model: "", ip: "", oob_ip: "" }]);
                                          document.getElementById("csvUpload").value = "";
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
                                      <p className="text-xs text-yellow-400 mt-1">
                                        CSV truncated to 20 devices (max limit).
                                      </p>
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
                          </div>
                        </div>

                        <div className="p-2 flex justify-end">
                          <Button
                            onPress={handleSubmit(handleDeployDevice)}
                            isLoading={deployLoading}
                            className="bg-pink-600 "
                          >
                            Deploy Devices to Netbox
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                key="5"
                aria-label="Accordion 5"
                title="Step 5: Deploy Devices from Netbox to Mist"
                isDisabled={!isSiteFullySelected}
              >
                <div className="  text-lg  ">
                  <div className="  mt-6 ">
                    <form className="w-Full flex justify-center">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 w-3/4 ">
                        <div className="p-2 dark text-foreground bg-transparent ">
                          <Input
                            size="sm"
                            label="Selected Site"
                            className="max-w-lg"
                            placeholder="Site Description"
                            variant="bordered"
                            value={siteCodeSelected}
                            isDisabled={
                              !isSiteFullySelected
                            }
                          />
                        </div>
                        <div className=" p-2 ">
                          <div className="dark text-foreground bg-background-pink-300 "></div>
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            isLoading={netboxToMistLoading}
                            onPress={handleSubmit(handleNetboxMistPush)}
                            className="bg-pink-600 "
                          >
                            Push Devices to Mist
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                isDisabled={!isSiteFullySelected}
                key="6"
                aria-label="Accordion 6"
                title="Step 6: Validate Site"
              >
                <div className="  text-lg  ">
                  <div className=" flex justify-center mt-6 ">
                    <form className="w-full">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 ">
                        <div className=" p-2 ">
                          <div className="dark text-foreground  ">
                            <h2 className="text-pink-400 text-lg font-bold">
                              Validation for {siteCodeSelected}
                            </h2>
                          </div>
                        </div>

                        {validation?.map((item) => (
                          <div className="p-2 dark text-foreground bg-transparent flex flex-row ">
                            <div className="flex justify-items-start text-sm w-full p-1	">
                              {item.msg}
                            </div>

                            <div className=" justify-self-end	">
                              {validateLoading ? (
                                <div className="flex justify-center items-center  ">
                                  <div className="relative inline-flex">
                                    <div className="w-5 h-5 bg-pink-600 rounded-full"></div>
                                    <div className="w-5 h-5 bg-pink-600 rounded-full absolute top-0 left-0 animate-ping"></div>
                                    <div className="w-5 h-5 bg-pink-600 rounded-full absolute top-0 left-0 animate-pulse"></div>
                                  </div>
                                </div>
                              ) : item.status === 0 ? (
                                validateBadIcon
                              ) : (
                                validateGoodIcon
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="p-2 flex justify-center">
                          <Button
                            isLoading={validateLoading}
                            onPress={handleSubmitDHCP(handleValidate)}
                            className="bg-pink-600 "
                          >
                            Validate {siteCodeSelected}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className=" mt-3 p-2 flex justify-center">
          <div>
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
        </div>
        {!skeletonLoading &&
          (postStatus === 0 || postStatus === 1) &&
          Array.isArray(createNetbox) &&
          createNetbox.length > 0 && (
          <div className="w-full max-w-2xl mx-auto mt-6">
            <div className={`flex items-center justify-between px-3 py-2 bg-[#0d2438] rounded-t-lg border ${postStatus === 0 ? "border-red-500/50" : postStatus === 1 ? "border-green-500/50" : "border-white/10"}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Results</span>
                <button
                  onClick={() => setLogFilter(logFilter === 1 ? null : 1)}
                  className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${logFilter === 1 ? "bg-green-600 text-white" : "bg-green-900/40 text-green-400 hover:bg-green-800/60"}`}
                >
                  ✓ {createNetbox.filter((m) => m.status !== 0).length}
                </button>
                <button
                  onClick={() => setLogFilter(logFilter === 0 ? null : 0)}
                  className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded transition-colors ${logFilter === 0 ? "bg-red-600 text-white" : "bg-red-900/40 text-red-400 hover:bg-red-800/60"}`}
                >
                  ✗ {createNetbox.filter((m) => m.status === 0).length}
                </button>
                {logFilter !== null && (
                  <button onClick={() => setLogFilter(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
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
                className={`text-xs px-2 py-1 rounded transition-colors ${logsCopied ? "bg-green-700 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}
              >
                {logsCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className={`overflow-y-auto max-h-[420px] bg-[#081b2a] border border-t-0 rounded-b-lg ${postStatus === 0 ? "border-red-500/50" : postStatus === 1 ? "border-green-500/50" : "border-white/10"}`}>
              {createNetbox.map((message, originalIndex) => (
                <div
                  key={`${resultKey}-${originalIndex}`}
                  className={`flex items-start gap-2 px-3 py-1.5 border-b border-white/5 text-xs font-mono last:border-0 ${message.status === 0 ? "text-red-300 animate-pulse10s" : "text-green-300 animate-bounceOnce"}`}
                  style={logFilter !== null && message.status !== logFilter
                    ? { height: 0, overflow: "hidden", padding: 0, borderBottom: "none", opacity: 0 }
                    : {}}
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

      {siteLoadError && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="text-5xl">⚠️</div>
          <p className="text-red-400 text-sm max-w-sm font-semibold">{siteLoadError}</p>
          <button
            onClick={() => {
              setSiteLoadError(null);
              setIsLoading(true);
              getToken().then((token) => GetAllSites({ token })).catch((err) => {
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
    </>
  );
};
