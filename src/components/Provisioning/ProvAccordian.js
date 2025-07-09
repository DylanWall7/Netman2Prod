import React from "react";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import DecryptedText from "./DecryptedTextProps";
import {
  Input,
  Button,
  Autocomplete,
  AutocompleteItem,
  Accordion,
  AccordionItem,
} from "@nextui-org/react";
import ProvisionLoading from "./ProvisionLoading";
import { GizmoRequest } from "../../authConfig";
import { set, useForm } from "react-hook-form";

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
  const ModelURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netbox/devicetypes`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

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
    setDhcpStatus("");
    setNetboxLoading(true);

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
    setValidation([]);
    setPostStatus("");
    setDhcpStatus("");
    setDhcpLoading(true);
    try {
      await CreatDHCPVlan1({
        token: await instance.acquireTokenSilent(request).then((response) => {
          return response.accessToken;
        }),
      });
    } catch (err) {
      console.log({ err });
      setDhcpLoading(false);
      setLoading(false);
    }
  };
  const handleCreateMist = async () => {
    setValidation([]);
    setPostStatus("");
    setDhcpStatus("");
    setMistLoading(true);
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
      setLoading(false);
    }
  };
  const handleDeployDevice = async () => {
    setValidation([]);
    setPostStatus("");
    setDhcpStatus("");
    setDeployLoading(true);
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
      setLoading(false);
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
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        setNetboxLoading(false);
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

      headers: headers,
    };

    return fetch(CreateMistURL, options)
      .then(async (response) => {
        let mistPostResponce = await response.json();

        setCreateNetbox(mistPostResponce?.log);
        setPostStatus(mistPostResponce?.status);

        setMistLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setMistLoading(false);
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

        setDeployLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setDeployLoading(false);
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
  async function CreatDHCPVlan1({ token }) {
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

    const allData = await Promise.all(
      allresponses.map((response) => response.json())
    );
    const [
      vlan1PostResponce,
      vlan5PostResponce,
      vlan9PostResponce,
      vlan13PostResponce,
    ] = allData;
    setVlan1(vlan1PostResponce.log);
    setVlan5(vlan5PostResponce.log);
    setVlan9(vlan9PostResponce.log);
    setVlan13(vlan13PostResponce.log);
    setDhcpStatus(vlan1PostResponce.status);
    setDhcpLoading(false);
    setLoading(false);
  }

  // React.useEffect(() => {
  //   setTimeout(() => {
  //     setPostStatus("");
  //   }, 300000);
  // }, [postStatus]);
  const RedTrashIcon = ({ fill = "currentColor", size = 24, ...props }) => (
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
        d="M6 18L18 6M6 6l12 12"
      />
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
    base: "py-0 w-full border rounded border-pink-200  ",
    title: "font-normal text-medium text-pink-400",
    trigger:
      "px-2 py-0 data-[hover=true]:bg-pink-300 rounded-lg h-14 flex items-center",
    indicator: "text-medium",
    content: "text-small px-2",
  };

  const [devices, setDevices] = React.useState([
    { serial: "", name: "", model: "" },
  ]);

  const handleInputChange = (index, event) => {
    const values = [...devices];
    values[index][event.target.name] = event.target.value;
    setDevices(values);
  };

  const handleAddDevice = () => {
    setDevices([...devices, { serial: "", name: "", model: "" }]);
  };

  const removeDevice = () => {
    setDevices(devices.slice(0, -1));
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
                            // onClick={handleSubmit(onSubmit)}
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
                            // onClick={handleSubmitDHCP(onSubmit)}
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
                            placeholder="Site Description"
                            value={siteCodeSelected}
                            isDisabled={
                              siteCodeSelected?.length > 1 ? false : true
                            }
                            {...registerMist("siteMist")}
                          />
                        </div>
                        <div className=" p-2 ">
                          <div className="dark text-foreground bg-background-pink-300 "></div>
                        </div>
                        <div className="p-2 flex justify-end">
                          <Button
                            isLoading={mistLoading}
                            // onClick={handleSubmit(onSubmit)}
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
                                      className="max-w-sm text-pink-400"
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

                                  <Button
                                    onPress={removeDevice}
                                    isIconOnly
                                    className="bg-red-500 hover:bg-red-400 active:scale-95 text-white shadow-md rounded-full p-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                                  >
                                    <RedTrashIcon fill="white" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-2 flex justify-end">
                          <Button
                            onPress={handleSubmit(handleDeployDevice)}
                            isLoading={deployLoading}
                            // onClick={handleSubmitDHCP(onSubmit)}
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
                isDisabled={siteCodeSelected?.length > 1 ? false : true}
                key="5"
                aria-label="Accordion 5"
                title="Step 5: Validate Site"
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
                                <div class="flex justify-center items-center  ">
                                  <div class="relative inline-flex">
                                    <div class="w-5 h-5 bg-pink-600 rounded-full"></div>
                                    <div class="w-5 h-5 bg-pink-600 rounded-full absolute top-0 left-0 animate-ping"></div>
                                    <div class="w-5 h-5 bg-pink-600 rounded-full absolute top-0 left-0 animate-pulse"></div>
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
                            // onClick={handleSubmitDHCP(onSubmit)}
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

        <div className=" p-2 flex justify-end">
          {dhcpStatus === 0 && (
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
          )}
          {dhcpStatus === 1 && (
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
          )}

          {postStatus === 0 && (
            <div
              style={{
                backgroundColor: "#011423",
                color: "#fff",
                padding: "20px",
                borderRadius: "8px",
                borderColor: "#6a7b8d",
                borderWidth: "2px",
                borderStyle: "solid",
                boxSizing: "border-box",
                boxShadow: "1px 2px 30px 1px rgba(146, 43, 33, 0.6)",
                maxWidth: "800px",
                margin: "20px auto",
                fontFamily: "Arial, sans-serif",
                textAlign: "left",
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px",
                  color: "#922b21",
                  fontSize: "25px",
                  textAlign: "center",
                }}
              >
                Error Message
              </h3>

              {Array.isArray(createNetbox) &&
                createNetbox.map((message, index) => (
                  <div key={index}>
                    <li>
                      <DecryptedText
                        speed={150}
                        className="text-md"
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
          )}
          {postStatus === 1 && (
            <div
              style={{
                backgroundColor: "#011423",
                color: "#fff",
                borderColor: "#6a7b8d",
                borderWidth: "2px",
                borderStyle: "solid",
                boxSizing: "border-box",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "1px 2px 30px 1px rgba(35, 155, 86, 0.6)",
                maxWidth: "800px",
                margin: "20px auto",
                fontFamily: "Arial, sans-serif",
                textAlign: "left",
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px",
                  color: "#239b56",

                  fontSize: "25px",
                  textAlign: "center",
                }}
              >
                Success Message
              </h3>
              {createNetbox?.map((message, index) => (
                <div>
                  <li>
                    <DecryptedText
                      speed={150}
                      className="text-md"
                      maxIterations={20}
                      key={index}
                      text={message.msg}
                      useOriginalCharsOnly={true}
                      animateOn="view"
                      revealDirection="center"
                    />
                  </li>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
