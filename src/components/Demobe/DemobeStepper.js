import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";
import ProvisionLoading from "../Provisioning/ProvisionLoading";
import {
  Autocomplete,
  AutocompleteItem,
  Select,
  SelectItem,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { useSearchParams } from "react-router-dom";

export default function DemobeStepper() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [siteCode, setSiteCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [postStatus, setPostStatus] = useState(null); // null, 0 (error), 1 (success)
  const [createNetbox, setCreateNetbox] = useState([]);
  const [seletonLoading, setSeletonLoading] = useState(false);
  const [siteList, setSiteList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dhcpJsonModal, setDhcpJsonModal] = useState(false);
  const [dhcpJsonData, setDhcpJsonData] = useState(null);
  const [dhcpJsonLoading, setDhcpJsonLoading] = useState(false);
  const [dhcpCopied, setDhcpCopied] = useState(false);
  const [selectedDays, setSelectedDays] = useState(() => {
    const daysParam = searchParams.get("days");
    return daysParam ? parseInt(daysParam, 10) : 90;
  });

  const siteurl = `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/snowlocations/${selectedDays}`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  const daysOptions = [
    { key: "30", label: "30 Days" },
    { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" },
    { key: "180", label: "180 Days" },
    { key: "365", label: "365 Days" },
  ];
  function resetforms() {
    setPostStatus("");
  }

  const handleDaysChange = (e) => {
    const newDays = Number(e.target.value);
    setSelectedDays(newDays);
    setSearchParams({ days: newDays.toString() });
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
  }, [accounts.length === 0, selectedDays]);

  async function GetAllSites({ token }) {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "application/json");

    const options = {
      method: "GET",
      headers: headers,
    };

    return fetch(siteurl, options)
      .then(async (response) => {
        let text = await response.json();

        setSiteList(text);
        setIsLoading(false);
      })

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
      });
  }

  const steps = [
    { id: 1, label: "Enter Site Code", url: `` },
    {
      id: 2,
      label: "Delete DHCP Scopes",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/dhcp/${siteCode}`,
    },
    {
      id: 3,
      label: "Unassign Mist Devices",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/mist/site/${siteCode}/devices`,
    },
    {
      id: 4,
      label: "Delete Mist Site",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/mist/site/${siteCode}`,
    },
    {
      id: 5,
      label: "Delete Netbox Site",
      url: `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/netbox/site/${siteCode}`,
    },
  ];

  const handleDelete = async () => {
    setShowModal(false);
    setSeletonLoading(true);

    try {
      const tokenResponse = await instance.acquireTokenSilent(request);
      const token = tokenResponse.accessToken;

      const { url, label } = steps[currentStep];

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`${label} failed (${response.status})`);
      }

      const Postresponse = await response.json();
      setCreateNetbox(Postresponse?.log);
      setPostStatus(Postresponse?.status);
      setSeletonLoading(false);

      // auto-advance
      // if (currentStep < steps.length - 1) {
      //   setCurrentStep((prev) => prev + 1);
      // }
    } catch (err) {
      console.error("Delete error:", err);
      setSeletonLoading(false);
    }
  };

  const dhcpToDeleteURL = `https://${process.env.REACT_APP_API_BASEURL}/api/deprovisioning/dhcp/${siteCode}/todelete`;

  const handleGenerateDHCP = async () => {
    setDhcpJsonLoading(true);
    try {
      const tokenResponse = await instance.acquireTokenSilent(request);
      const token = tokenResponse.accessToken;

      const response = await fetch(dhcpToDeleteURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const { status, log, ...dhcpConfig } = await response.json();
      setPostStatus(status);
      setCreateNetbox(log);
      setDhcpJsonData(dhcpConfig);
      setDhcpJsonLoading(false);
      setDhcpJsonModal(true);
    } catch (err) {
      console.error("DHCP generate error:", err);
      setDhcpJsonLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  return (
    <>
      {isLoading && <ProvisionLoading loading={isLoading} />}
      <div className="mt-8 text-white flex flex-col items-center justify-center p-6">
        <div className="">
          <div className="  ml-5">
            <div className="max-w-3xl mx-auto text-center mt-4">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-red-500">
                  Demobe Wizard
                </span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500"></span>
              </h1>
              <p className="text-sm text-pink-400 mb-8">
                Demobe a site with the following steps.
              </p>
            </div>
          </div>
        </div>
        {/* Stepper Header */}
        <div className="flex items-center justify-center space-x-6 mb-10">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold
              ${index === currentStep ? "bg-blue-500" : "bg-gray-700"}`}
              >
                {index + 1}
              </div>
              {index !== steps.length - 1 && (
                <div className="w-12 h-1 bg-gray-700 mx-2"></div>
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
          <h2 className="text-xl font-bold mb-4">{steps[currentStep].label}</h2>

          {currentStep === 0 ? (
            <div className="p-2">
              <div className="dark text-foreground flex gap-3 items-start">
                <div className="flex-shrink-0" style={{ width: "140px" }}>
                  <Select
                    label="Closed in Last"
                    size="sm"
                    selectedKeys={[String(selectedDays)]}
                    onChange={handleDaysChange}
                    variant="bordered"
                  >
                    {daysOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex-1">
                  <Autocomplete
                    size="sm"
                    label="Site Code (From ServiceNow)"
                    menuTrigger="input"
                    placeholder="Site Code"
                    className="text-pink-400"
                    variant="bordered"
                    onInputChange={(value) => {
                      setSiteCode(value);
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
            </div>
          ) : currentStep === 1 ? (
            <div>
              <p className="text-lg mb-4">
                Site Code:{" "}
                <span className="font-mono text-blue-400">
                  {siteCode || "N/A"}
                </span>
              </p>
              {/* <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 transition"
              >
                {steps[currentStep].label}
              </button> */}
              <Button
                onPress={dhcpJsonData ? () => setDhcpJsonModal(true) : handleGenerateDHCP}
                className="bg-pink-600"
                isLoading={dhcpJsonLoading}
              >
                {dhcpJsonData ? "Show DHCP JSON" : "Generate DHCP JSON"}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-lg mb-4">
                Site Code:{" "}
                <span className="font-mono text-blue-400">
                  {siteCode || "N/A"}
                </span>
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 transition"
              >
                {steps[currentStep].label}
              </button>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button
              onClick={() => {
                resetforms();
                prevStep();
              }}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
            >
              Back
            </button>
            {currentStep < steps.length - 1 && (
              <button
                onClick={() => {
                  resetforms();
                  nextStep();
                }}
                disabled={seletonLoading || (currentStep === 0 && !siteCode)}
                className="px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {seletonLoading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : (
                  "Next"
                )}
              </button>
            )}
          </div>
        </div>
        <div className="mt-8">
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

        <Modal
          isOpen={dhcpJsonModal}
          onOpenChange={setDhcpJsonModal}
          size="3xl"
          scrollBehavior="inside"
          classNames={{ base: "dark text-foreground" }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1 text-pink-400">
                  DHCP JSON — {siteCode}
                </ModalHeader>
                <ModalBody>
                  <pre className="bg-zinc-900 text-green-300 text-sm rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all">
                    {dhcpJsonData?.data
                      ? JSON.stringify(dhcpJsonData.data, null, 2)
                      : "No data returned."}
                  </pre>
                </ModalBody>
                <ModalFooter>
                  <Button className="bg-zinc-700 text-white" onPress={onClose}>
                    Close
                  </Button>
                  <Button
                    className={dhcpCopied ? "bg-green-600" : "bg-pink-600 text-black"}
                    onPress={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(dhcpJsonData?.data, null, 2)
                      );
                      setDhcpCopied(true);
                      setTimeout(() => setDhcpCopied(false), 2000);
                    }}
                  >
                    {dhcpCopied ? "Copied!" : "Copy JSON"}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-xl">
              <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to {steps[currentStep].label} for{" "}
                <span className="font-semibold text-red-400">{siteCode}</span>?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
