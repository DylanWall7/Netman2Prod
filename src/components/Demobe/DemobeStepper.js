import React, { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../../authConfig";

export default function DemobeStepper() {
  const [currentStep, setCurrentStep] = useState(0);
  const [siteCode, setSiteCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [postStatus, setPostStatus] = useState(null); // null, 0 (error), 1 (success)
  const [createNetbox, setCreateNetbox] = useState([]);
  const [seletonLoading, setSeletonLoading] = useState(false);

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };
  function resetforms() {
    setPostStatus("");
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
      label: "Delete Devices",
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
      // url: `https://${process.env.REACT_APP_API_BASEURL}/api/netbox/sites/${siteCode}`,
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

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  return (
    <div className="mt-10 text-white flex flex-col items-center justify-center p-6">
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
          <input
            type="text"
            placeholder="Enter Site Code"
            value={siteCode}
            onChange={(e) => setSiteCode(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
              Delete Step
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
              disabled={currentStep === 0 && !siteCode}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
            >
              Next
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

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to {steps[currentStep].label} and
              decommission site{" "}
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
  );
}
