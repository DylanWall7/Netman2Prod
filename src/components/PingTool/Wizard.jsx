import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Autocomplete, AutocompleteItem, Button } from "@nextui-org/react";
import { GizmoRequest } from "../../authConfig";
import { set, useForm } from "react-hook-form";
import { useMsal } from "@azure/msal-react";

const steps = [
  { title: "Site Details", component: SiteDetailsStep },
  { title: "Theme & Layout", component: ThemeLayoutStep },
  { title: "Review & Deploy", component: ReviewDeployStep },
];

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    siteName: "",
    theme: "dark",
    deploy: false,
  });

  const StepComponent = steps[currentStep].component;

  const nextStep = () =>
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-8">
      {/* Step Indicators */}
      <div className="flex space-x-4 mb-8">
        {steps.map((step, index) => (
          <div key={step.title} className="flex items-center">
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full 
              ${index <= currentStep ? "bg-blue-500" : "bg-neutral-700"}`}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 w-12 ${
                  index < currentStep ? "bg-blue-500" : "bg-neutral-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="bg-neutral-800 p-6 rounded-xl shadow-lg w-full max-w-xl"
        >
          <h2 className="text-xl font-semibold mb-4">
            {steps[currentStep].title}
          </h2>
          <StepComponent formData={formData} setFormData={setFormData} />
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-between w-full max-w-xl">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="px-4 py-2 bg-neutral-700 rounded-lg hover:bg-neutral-600 disabled:opacity-50"
        >
          Back
        </button>
        {currentStep < steps.length - 1 ? (
          <button
            onClick={nextStep}
            className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-400"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => alert(JSON.stringify(formData, null, 2))}
            className="px-4 py-2 bg-green-500 rounded-lg hover:bg-green-400"
          >
            Deploy
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Step Components ---- */

function SiteDetailsStep({ formData, setFormData }) {
  const [createNetbox, setCreateNetbox] = useState("");
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const [siteCodeSelected, setSiteCodeSelected] = useState(new Set([]));
  const [isLoading, setIsLoading] = useState(false);
  const [siteList, setSiteList] = useState([]);
  const [postStatus, setPostStatus] = useState("");

  const [netboxLoading, setNetboxLoading] = useState(false);

  const NetboxURL = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/netboxsite/${siteCodeSelected}`;
  const url = `https://${process.env.REACT_APP_API_BASEURL}/api/provisioning/snowlocations`;

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

      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
      });
  }

  const handleAddNetbox = async () => {
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
  return (
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
  );
}

function ThemeLayoutStep({ formData, setFormData }) {
  return (
    <div>
      <label className="block mb-2">Theme</label>
      <select
        value={formData.theme}
        onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-neutral-700 text-white"
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="custom">Custom</option>
      </select>
    </div>
  );
}

function ReviewDeployStep({ formData }) {
  return (
    <div>
      <p>
        <strong>Site Name:</strong> {formData.siteName}
      </p>
      <p>
        <strong>Theme:</strong> {formData.theme}
      </p>
      <p className="text-yellow-400 mt-4">
        Review your settings before deploying.
      </p>
    </div>
  );
}
