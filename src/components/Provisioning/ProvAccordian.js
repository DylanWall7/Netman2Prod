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
import ProvisionLoading from "./ProvisionLoading";
import { GizmoRequest } from "../../authConfig";
import { set, useForm } from "react-hook-form";
import { use } from "react";

export const ProvAccordian = () => {
  const [dhcpSite, setDHCPSite] = React.useState("");
  const [createNetbox, setCreateNetbox] = React.useState("");
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = React.useState(false);
  const [siteCodeSelected, setSiteCodeSelected] = React.useState(new Set([]));
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
  const [seletonLoading, setSeletonLoading] = React.useState(false);
  const [netboxToMistLoading, setNetboxToMistLoading] = React.useState(false);
  const [availableIps, setAvailableIps] = useState([]);
  const [ipIndex, setIpIndex] = useState(0);
  const [nextIpLoading, setNextIpLoading] = React.useState(false);

  const [dhcpData, setDhcpData] = useState({
    status: null,
    logs: {},
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
  const nextIPURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCodeSelected}/addresses`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  function resetforms() {
    setValidation([]);
    setPostStatus("");
    setDhcpStatus("");
    setVlan1([]);
    setVlan5([]);
    setVlan9([]);
    setVlan13([]);
    setDhcpData({
      status: null,
      logs: {},
    });
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        GetAllSites({
          token: await instance.acquireTokenSilent(request).then((response) => {
            return response.accessToken;
          }),
        });
      } catch (err) {
        setIsLoading(false);
        console.log({ err });
        setLoading(false);
      }
    })();
  }, [accounts.length === 0]);

  const handleAddNetbox = async () => {
    resetforms();
    setNetboxLoading(true);
    setSeletonLoading(true);

    try {
      CreateNetbox({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setNetboxLoading(false);
      setLoading(false);
      setSeletonLoading(true);
    }
  };
  const handleNetboxMistPush = async () => {
    resetforms();
    setNetboxToMistLoading(true);
    setSeletonLoading(true);

    try {
      PushDevicesFromNetboxToMist({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setNetboxToMistLoading(false);
      setLoading(false);
      setSeletonLoading(true);
    }
  };
  const handleValidate = async () => {
    setValidateLoading(true);

    try {
      ValidateSite({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setLoading(false);
    }
  };
  const handleDHCP = async () => {
    resetforms();
    setDhcpLoading(true);
    setSeletonLoading(true);
    try {
      await CreatDHCPAllVlan({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setDhcpLoading(false);
      setSeletonLoading(false);
      setLoading(false);
    }
  };
  const handleCreateMist = async () => {
    resetforms();
    setMistLoading(true);
    setSeletonLoading(true);
    try {
      await CreateMistSite({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setDhcpLoading(false);
      setMistLoading(false);
      setSeletonLoading(false);
      setLoading(false);
    }
  };
  const handleDeployDevice = async () => {
    resetforms();
    setDeployLoading(true);
    setSeletonLoading(true);
    try {
      await DeplyDevicetoNetbox({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setDhcpLoading(false);
      setDeployLoading(false);
      setSeletonLoading(false);
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
      console.log({ err });
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
        let netboxPostResponce = await response.json();

        setCreateNetbox(netboxPostResponce?.log);
        setPostStatus(netboxPostResponce?.status);

        setIsLoading(false);
        setNetboxLoading(false);
        setSeletonLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setNetboxLoading(false);
        setSeletonLoading(false);
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
        gateway_template: template?.currentKey,
      }),
      headers: headers,
    };

    return fetch(CreateMistURL, options)
      .then(async (response) => {
        let mistPostResponce = await response.json();

        setCreateNetbox(mistPostResponce?.log);
        setPostStatus(mistPostResponce?.status);
        setSeletonLoading(false);
        setMistLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setMistLoading(false);
        setSeletonLoading(false);
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
        let DeployDevicePostResponce = await response.json();

        setCreateNetbox(DeployDevicePostResponce?.log);
        setPostStatus(DeployDevicePostResponce?.status);
        setSeletonLoading(false);
        setDeployLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setDeployLoading(false);
        setSeletonLoading(false);
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

    const options = {
      method: "POST",

      headers: headers,
    };

    const allresponses = await Promise.all([
      fetch(vlan1URL, options),
      fetch(vlan5URL, options),
      fetch(vlan9URL, options),
      fetch(vlan13URL, options),
    ]).catch((error) => {
      console.error("Error:", error);
      setLoading(false);
    });

    const data = await Promise.all(
      allresponses.map((response) => response.json())
    );
    const vlanKeys = ["vlan1", "vlan5", "vlan9", "vlan13"];
    const logs = vlanKeys.reduce((acc, key, i) => {
      acc[key] = data[i].log || [];
      return acc;
    }, {});

    setDhcpData({ status: data[0].status, logs });

    setDhcpLoading(false);
    setSeletonLoading(false);
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
        let netboxPostResponce = await response.json();

        setCreateNetbox(netboxPostResponce?.log);
        setPostStatus(netboxPostResponce?.status);

        setIsLoading(false);
        setNetboxToMistLoading(false);
        setSeletonLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setNetboxToMistLoading(false);
        setSeletonLoading(false);
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

      setIsLoading(false);
      setAvailableIps(nextipList.data);

      return nextipList.data;
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      return [];
    }
  }

  const Templates = [
    { key: "V102_SRX3XX_INTERNET", label: "V102_SRX3XX_INTERNET" },
    { key: "V102_SRX3XX_DUAL_INTERNET", label: "V102_SRX3XX_DUAL_INTERNET" },
    { key: "V102_SRX3XX_KPN", label: "V102_SRX3XX_KPN" },
    { key: "V102_SRX3XX_KPN_INET", label: "V102_SRX3XX_KPN_INET" },
  ];
  const handleImportCSV = (event) => {
    setDevices([]);
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

      setDevices((prev) => [...prev, ...parsedDevices]);
    };
    reader.readAsText(file);
  };

  // React.useEffect(() => {
  //   setTimeout(() => {
  //     setPostStatus("");
  //   }, 300000);
  // }, [postStatus]);
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

  const itemClasses = {
    base: "py-0 w-full border rounded border-pink-200",
    title: "font-normal text-medium text-pink-400",
    trigger:
      "px-2 py-0 data-[hover=true]:bg-pink-300 rounded-lg h-14 flex items-center",
    indicator: "text-medium",
    content: "text-small px-2",
  };

  const [devices, setDevices] = React.useState([
    { serial: "", name: "", model: "", ip: "" },
  ]);

  const handleInputChange = (index, event) => {
    const values = [...devices];
    values[index][event.target.name] = event.target.value;
    setDevices(values);
  };
  // const handleAddDevice = () => {
  //   setDevices((prev) => {
  //     let ipToAssign = "";

  //
  //     if (availableIps.length > 0) {
  //       ipToAssign = availableIps[0];
  //       setAvailableIps((prevIps) => prevIps.slice(1));
  //     }

  //     return [...prev, { serial: "", name: "", model: "", ip: ipToAssign }];
  //   });
  // };
  const handleFillIPs = async () => {
    const ips = await handleGetAvailableIps();

    setDevices((prevDevices) => {
      const usedIps = prevDevices.map((d) => d.ip).filter(Boolean);

      let freeIps = ips.filter((ip) => !usedIps.includes(ip));

      const updated = prevDevices.map((device) => {
        if (
          device.model?.startsWith("EX") &&
          !/_\d+$/.test(device.name ?? "") &&
          !device.ip
        ) {
          const ip = freeIps.shift();
          return ip ? { ...device, ip } : device;
        }
        return device;
      });

      setAvailableIps(freeIps);
      return updated;
    });
  };
  const handleClearIPs = () => {
    setDevices((prevDevices) => {
      const usedIps = prevDevices.map((d) => d.ip).filter(Boolean);
      setAvailableIps((prevIps) => [...prevIps, ...usedIps]);
      return prevDevices.map((d) => ({ ...d, ip: "" }));
    });
  };

  const handleAddDevice = () => {
    setDevices([...devices, { serial: "", name: "", model: "", ip: "" }]);
  };

  const handleRemoveDevice = (index) => {
    setDevices((prev) => prev.filter((_, i) => i !== index));
  };

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

  return (
    <>
      {isLoading && <ProvisionLoading loading={isLoading} />}
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
                Provision a site with the following steps.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex flex-col justify-start ml-5">
            <Accordion itemClasses={itemClasses} keepContentMounted={true}>
              <AccordionItem
                key="1"
                aria-label="Accordion 1"
                title="Step 1: Create Site in Netbox"
                className="text-pink-400"
              >
                <div className="  text-lg  ">
                  <div className="flex justify-start">
                    <div className="flex justify-start ml-5"></div>
                  </div>
                  <div className=" mt-6 ">
                    <form className="w-full flex justify-center">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 w-3/4 ">
                        <div className=" p-2 ">
                          <div className="dark text-foreground  ">
                            <Autocomplete
                              size="sm"
                              label="Site Code (From ServiceNow)"
                              menuTrigger="input"
                              placeholder="Site Code"
                              className="max-w-sm text-pink-400"
                              variant="bordered"
                              onInputChange={(value) => {
                                setSiteCodeSelected(value);
                              }}
                            >
                              {siteList.data?.map((site) => (
                                <AutocompleteItem value={site} key={site.id}>
                                  {site ? site : "No Site Code"}
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>
                          </div>
                        </div>
                        <div className=" p-2 "></div>
                        <div className="p-2 flex justify-end">
                          <Button
                            isLoading={netboxLoading}
                            onPress={handleSubmit(handleAddNetbox)}
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
                key="2"
                aria-label="Accordion 2"
                title="Step 2: Deploy DHCP"
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
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
                              siteCodeSelected?.length > 1 ? false : true
                            }
                          />
                        </div>
                        <div className=" p-2 ">
                          <div className="dark text-foreground bg-background-pink-300 "></div>
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            onPress={handleDHCP}
                            onPressStart={() =>
                              setValue("siteDHCP", siteCodeSelected)
                            }
                            className="bg-pink-600 "
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
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
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
                              siteCodeSelected?.length > 1 ? false : true
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
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
              >
                <div className="  text-lg  ">
                  <div className=" flex justify-left mt-6 ">
                    <form className="w-full">
                      <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 ">
                        <div className="p-2 dark text-foreground bg-transparent ">
                          <div className=" ">
                            <div className=" px-2 py-3 text-left leading-4 text-pink-400 tracking-wider">
                              Device Assign List
                            </div>
                            <div>
                              {devices.map((device, index) => (
                                <div
                                  key={index}
                                  className="flex w-full flex-wrap md:flex-nowrap gap-2 m-2"
                                >
                                  <Input
                                    classNames={{
                                      label: "text-pink-400",
                                      input: ["placeholder:text-pink-400"],
                                      innerWrapper: "bg-transparent",
                                      inputWrapper: [
                                        "bg-pink-300",
                                        "border-zinc-600",
                                        "rounded-lg",
                                        "border",
                                        "border-2",
                                        "border-opacity-70",
                                        "hover:border-zinc-500",
                                        "h-full",
                                      ],
                                    }}
                                    type="text"
                                    name="serial"
                                    value={device.serial}
                                    onChange={(event) =>
                                      handleInputChange(index, event)
                                    }
                                    placeholder="Serial Number"
                                  />
                                  <Input
                                    classNames={{
                                      label: "text-pink-400",
                                      input: ["placeholder:text-pink-400"],
                                      innerWrapper: "bg-transparent",
                                      inputWrapper: [
                                        "bg-pink-300",
                                        "border-zinc-600",
                                        "rounded-lg",
                                        "border",
                                        "border-opacity-70",
                                        "border-2",
                                        "hover:border-zinc-500",
                                        "h-full",
                                      ],
                                    }}
                                    type="text"
                                    size="small"
                                    name="name"
                                    value={device.name}
                                    onChange={(event) =>
                                      handleInputChange(index, event)
                                    }
                                    placeholder="Device Name"
                                  />
                                  <div className="dark w-full ">
                                    <Autocomplete
                                      size="sm"
                                      label="Model"
                                      menuTrigger="input"
                                      placeholder="Model"
                                      className="w-full  text-pink-400"
                                      variant="bordered"
                                      selectedKey={device.model}
                                      onSelectionChange={(value) => {
                                        const values = [...devices];
                                        values[index].model = value;
                                        setDevices(values);
                                      }}
                                    >
                                      {modelList.map((model) => (
                                        <AutocompleteItem
                                          key={model}
                                          value={model}
                                        >
                                          {model ? model : "No Model"}
                                        </AutocompleteItem>
                                      ))}
                                    </Autocomplete>
                                  </div>
                                  <Input
                                    classNames={{
                                      label: "text-pink-400",
                                      input: ["placeholder:text-pink-400"],
                                      innerWrapper: "bg-transparent",
                                      inputWrapper: [
                                        "bg-pink-300",
                                        "border-zinc-600",
                                        "rounded-lg",
                                        "border",
                                        "border-2",
                                        "border-opacity-70",
                                        "hover:border-zinc-500",
                                        "h-full",
                                      ],
                                    }}
                                    type="text"
                                    name="ip"
                                    value={device.ip}
                                    onChange={(event) =>
                                      handleInputChange(index, event)
                                    }
                                    placeholder="IP Address"
                                  />
                                  <Button
                                    onPress={() => handleRemoveDevice(index)}
                                    isIconOnly
                                    variant="light"
                                  >
                                    <RedTrashIcon />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            {devices.length < 500 && (
                              <div className="flex justify-start">
                                <div className="m-2 flex gap-2">
                                  <Button
                                    onPress={handleAddDevice}
                                    isIconOnly
                                    className="bg-green-500 hover:bg-green-400 active:scale-95 text-white shadow-md rounded-full p-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-300"
                                  >
                                    <GreenPlusIcon fill="white" />
                                  </Button>

                                  <div>
                                    <div className="flex gap-3 ">
                                      <input
                                        type="file"
                                        accept=".csv"
                                        id="csvUpload"
                                        className="hidden"
                                        onChange={handleImportCSV}
                                      />
                                      <Button
                                        onPress={() =>
                                          document
                                            .getElementById("csvUpload")
                                            .click()
                                        }
                                        className=" relative flex items-center bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg rounded-lg px-4 py-2 font-semibold transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="w-5 h-5 animate-bounce-slow"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 17v-6h6v6m-6 0h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a2 2 0 01-2 2z"
                                          />
                                        </svg>
                                        Import CSV
                                        <span className="  inset-0 rounded-lg bg-white/10 opacity-0 hover:opacity-100 transition duration-300"></span>
                                      </Button>

                                      <Button
                                        onPress={() => {
                                          setDevices([]);
                                          document.getElementById(
                                            "csvUpload"
                                          ).value = "";
                                        }}
                                        className="relative flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-500 hover:to-orange-500 text-white shadow-lg rounded-lg px-4 py-2 font-semibold transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                                      >
                                        Clear CSV
                                      </Button>
                                    </div>
                                    <div className="flex gap-3 mt-4">
                                      <Button
                                        onPress={handleFillIPs}
                                        className="relative flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg rounded-lg px-4 py-2 font-semibold transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                                      >
                                        Fill IPs
                                      </Button>
                                      <Button
                                        onPress={handleClearIPs}
                                        className="relative flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-500 hover:to-orange-500 text-white shadow-lg rounded-lg px-4 py-2 font-semibold transition-all duration-300 ease-out hover:scale-105 active:scale-95"
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
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
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
                              siteCodeSelected?.length > 1 ? false : true
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
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
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
          {/* {dhcpStatus === 0 && (
            <div className="flex-col justify-start ml-5">
              {[vlan1, vlan5, vlan9, vlan13].map(
                (vlanLog, index) =>
                  vlanLog && (
                    <div>
                      {Array.isArray(vlanLog) &&
                        vlanLog.map((message, msgIndex) => (
                          <div key={msgIndex}>
                            <li>
                              <DecryptedText
                                speed={150}
                                className="text-md text-white"
                                maxIterations={20}
                                text={message.msg}
                                useOriginalCharsOnly={true}
                                animateOn="view"
                                revealDirection="center"
                              />
                            </li>
                          </div>
                        ))}
                    </div>
                  )
              )}
            </div>
          )} */}
          {/* {dhcpStatus === 1 && (
            <div className="flex-col justify-start ml-5">
              {[vlan1, vlan5, vlan9, vlan13].map(
                (vlanLog, index) =>
                  vlanLog && (
                    <div>
                      {Array.isArray(vlanLog) &&
                        vlanLog.map((message, msgIndex) => (
                          <div key={msgIndex}>
                            <li>
                              <DecryptedText
                                speed={150}
                                className="text-md text-white"
                                maxIterations={20}
                                text={message.msg}
                                useOriginalCharsOnly={true}
                                animateOn="view"
                                revealDirection="center"
                              />
                            </li>
                          </div>
                        ))}
                    </div>
                  )
              )}
            </div>
          )} */}
          {(dhcpData.status === 0 || dhcpData.status === 1) && (
            <div
              className={`max-w-2xl mx-auto p-6 rounded-2xl shadow-lg border-2 transition-all duration-500 mt-6
      ${
        dhcpData.status === 0
          ? "bg-red-900/20 border-red-700"
          : "bg-green-900/20 border-green-700"
      }`}
            >
              <h3
                className={`text-2xl font-bold text-center mb-4 transition-colors duration-500
        ${dhcpData.status === 0 ? "text-red-500" : "text-green-400"}`}
              >
                {dhcpData.status === 0
                  ? "DHCP Error Logs"
                  : "DHCP Success Logs"}
              </h3>

              <div className="space-y-4">
                {Object.entries(dhcpData.logs).map(([vlanName, vlanLog]) =>
                  Array.isArray(vlanLog) ? (
                    <ul className="space-y-2">
                      {vlanLog.map((message, msgIndex) => (
                        <li
                          key={msgIndex}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-300
                    ${
                      dhcpData.status === 0
                        ? "bg-red-800/30 text-red-200 before:content-['!'] before:text-red-400 before:font-bold before:mr-1 animate-pulse10s"
                        : "bg-green-800/30 text-green-200 before:content-['✓'] before:text-green-400 before:font-bold before:mr-1 animate-bounceOnce"
                    }`}
                        >
                          <span className="text-md">{message.msg}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null
                )}
              </div>
            </div>
          )}
          <div>
            {seletonLoading && (
              <div className="flex flex-col gap-2 ml-5 w-80">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-4 bg-gray-700 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            )}

            {!seletonLoading && (postStatus === 0 || postStatus === 1) && (
              <div
                className={`max-w-2xl mx-auto p-6 rounded-2xl shadow-lg border-2 transition-all duration-5
            ${
              postStatus === 0
                ? "bg-red-900/20 border-red-700"
                : "bg-green-900/20 border-green-700"
            }`}
              >
                <h3
                  className={`text-2xl font-bold text-center mb-4 transition-colors duration-5
              ${postStatus === 0 ? "text-red-500" : "text-green-400"}`}
                >
                  {postStatus === 0 ? "Error Message" : "Success Message"}
                </h3>

                <ul className="space-y-2">
                  {Array.isArray(createNetbox) &&
                    createNetbox.map((message, index) => (
                      <li
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-3
                    ${
                      postStatus === 0
                        ? "bg-red-800/30 text-red-200 animate-pulse10s before:content-['!'] before:text-red-400 before:font-bold before:mr-2"
                        : "bg-green-800/30 text-green-200 animate-bounceOnce before:content-['✓'] before:text-green-400 before:font-bold before:mr-2"
                    }`}
                      >
                        <span className="text-md">{message.msg}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
