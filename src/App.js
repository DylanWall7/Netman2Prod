import React, { useState, useEffect } from "react";
import { PageLayout } from "./components/PageLayout";
import { NextUIProvider } from "@nextui-org/react";
import { Routes, Route } from "react-router-dom";
import { NoMatch } from "./components/NoMatch";
import "./App.css";
import { ProvAccordian } from "./components/Provisioning/ProvAccordian";
import { Validate } from "./components/Provisioning/Validate";
import { HomeLayout } from "./components/HomePage/HomeLayout";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { GizmoRequest } from "./authConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import DemobeStepper from "./components/Demobe/DemobeStepper";
import UserProfile from "./components/User/UserProfile";
import LogsPage from "./components/LogPage/LogFile";
import MobeBenchTable from "./components/Workbench/WorkbenchList";
import { ManageDevicePage } from "./components/ManageDevice/ManageDevicePage";
import { loginRequest } from "./authConfig";
import DHCPManager from "./components/ManageDHCP/DHCPManager";
import OpengearReports from "./components/Reports/OpengearReports";

function App() {
  const url = `https://${process.env.REACT_APP_API_BASEURL}/api/mist/site/summary`;
  const [siteList, setSiteList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (accounts.length === 0) {
          await instance.loginRedirect(loginRequest);
          return;
        }

        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          await instance.loginRedirect(loginRequest);
        } else {
          console.error("error:", error);
        }
      }
    };

    initAuth();
  }, [instance, accounts]);

  useEffect(() => {
    const fetchSites = async () => {
      if (accounts.length === 0) return;

      setIsLoading(true);
      try {
        const response = await instance.acquireTokenSilent(request);
        const token = response.accessToken;

        await GetAllMistSites({ token });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  async function GetAllMistSites({ token }) {
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

  return (
    <NextUIProvider>
      <PageLayout>
        <AuthenticatedTemplate>
          {/* <div className="px-4 py-3 text-black bg-yellow-500">
            <p className="text-sm font-medium text-center">
              This tool is currently under development. Modifications will be
              made frequently and you may encounter bugs.
            </p>
          </div> */}

          <Routes>
            <Route path="/" element={<HomeLayout />} />

            {/* <Route path="mistassigntool" element={<MainAssign />}></Route> */}

            {/* <Route
              path="addnewsite"
              element={<AddNewSite siteList={siteList} />}
            ></Route> */}
            <Route
              path="provision"
              element={<ProvAccordian siteList={siteList} />}
            ></Route>
            {/* <Route
              path="step2"
              element={<DeployDHCP siteList={siteList} />}
            ></Route> */}
            <Route path="validate" element={<Validate />}></Route>
            {/* <Route path="ping" element={<Ping />} /> */}
            {/* <Route path="terminallist" element={<TerminalList />} /> */}
            {/* <Route path="devicesearch" element={<SearchPage />} /> */}
            {/* <Route path="/device/:name" element={<DevicePage />} /> */}
            <Route path="demobe" element={<DemobeStepper />} />
            <Route path="profile" element={<UserProfile />} />
            {/* <Route path="logs" element={<LogsPage />} /> */}
            <Route path="workbench" element={<MobeBenchTable />} />
            <Route path="managedevices" element={<ManageDevicePage />}></Route>
            <Route path="opengear" element={<OpengearReports />}></Route>
            {/* <Route path="dhcpmanager" element={<DHCPManager />}></Route> */}
            {/* <Route path="ogtemplate" element={<OgTemplate />} /> */}
            {/* <Route
              path="mistassigntool/:siteCode"
              element={<MistAssignSiteProv siteList={siteList} />}
            /> */}
            {/* <Route path="prov" element={<MainProv />}></Route> */}
            {/* <Route path="prov/:siteCode" element={<SiteProv />} /> */}
            {/* <Route
              path="/prov/:siteCode/:deviceName"
              element={<DeviceProv />}
            /> */}

            <Route path="*" element={<NoMatch />} />
          </Routes>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          {/* <div className="grid mt-40 px-4 place-content-center">
            <div className="text-center  ">
              <div className="flex justify-center">
                <img width="64" height="64" alt="Caution Icon" />
              </div>

              <p className="text-2xl font-bold tracking-tight text-gray-400 sm:text-4xl">
                You are not signed in
              </p>

              <p className="mt-4 text-gray-500">Please sign in. </p>
            </div>
          </div> */}
          <div className="pt-40 grid place-items-center  px-4">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                {/* Warning/Caution Icon */}
                <svg
                  className="w-16 h-16 text-yellow-500 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.74-3L13.74 4c-.77-1.33-2.71-1.33-3.48 0L3.19 16c-.76 1.33.2 3 1.74 3z"
                  />
                </svg>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                You are not signed in
              </h1>

              <p className="text-gray-400">
                Please sign in to access this page.
              </p>
            </div>
          </div>
        </UnauthenticatedTemplate>
      </PageLayout>
    </NextUIProvider>
  );
}

export default App;
