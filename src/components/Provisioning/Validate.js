import React from "react";
import { useState } from "react";

import { Input, Button } from "@nextui-org/react";

import { useMsal } from "@azure/msal-react";

import { GizmoRequest } from "../../authConfig";

export const Validate = () => {
  const [siteName, setSiteName] = React.useState("");
  const [validateLoading, setValidateLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [validation, setValidation] = useState([]);
  const ValidateURL = `https://${process.env.REACT_APP_API_BASEURL}/api/validation/netboxsite/${siteName}`;

  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
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
    <div className="  text-lg  ">
      <div className="flex justify-center">
        <div className="flex justify-start ml-5">
          <div class="max-w-3xl mx-auto text-center mt-16">
            <h1 class="text-3xl font-bold text-gray-900 leading-tight mb-2 pb-4 relative">
              <span class="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
                Validate Site
              </span>
              <span class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-pink-500"></span>
            </h1>
            <p class="text-sm text-pink-400 mb-8">
              This will check if any part of this site exists.
            </p>
          </div>
        </div>
      </div>
      <div className=" flex justify-center mt-6 ">
        <form className="w-1/2">
          <div className=" border-pink-200 border-large rounded-lg p-5 flex flex-col bg-pink-300 ">
            <div className=" p-2 ">
              <div className="dark text-foreground  ">
                <Input
                  size="sm"
                  label="Selected Site"
                  className="max-w-lg"
                  placeholder="Site Code"
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
            </div>

            {validation.map((item) => (
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

            <div className="p-2 flex justify-end">
              <Button
                isLoading={validateLoading}
                onClick={handleValidate}
                className="bg-pink-600 "
              >
                Validate Site
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
