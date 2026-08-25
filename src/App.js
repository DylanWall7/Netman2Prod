import React from "react";
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

import DemobeStepper from "./components/Demobe/DemobeStepper";
import UserProfile from "./components/User/UserProfile";
import LogsPage from "./components/LogPage/LogFile";
import MobeBenchTable from "./components/Workbench/WorkbenchList";
import { ManageDevicePage } from "./components/ManageDevice/ManageDevicePage";
import DHCPManager from "./components/ManageDHCP/DHCPManager";
import DHCPSiteSelect from "./components/ManageDHCP/DHCPSiteSelect";
import OpengearReports from "./components/Reports/OpengearReports";
import ReportLandingPage from "./components/Reports/ReportLandingPage";
import NetworkSearchHome from "./components/NetworkSearch/NetworkSearchHome";
import NetworkSearch from "./components/NetworkSearch/NetworkSearch";
import DeviceOutputsBySite from "./components/NetworkSearch/DeviceOutputsBySite";
import TopologyView from "./components/Topology/topologyView";
import SiteDiagramsView from "./components/SiteDiagrams/SiteDiagramsView";
import InventoryScanPage from "./components/InventoryScan/InventoryScanPage";
import DepotManagerHome from "./components/DepotOrders/DepotManagerHome";
import DashboardPage from "./components/DepotOrders/DashboardPage";
import ManagePage from "./components/DepotOrders/ManagePage";
import SupplierOrdersPage from "./components/DepotOrders/SupplierOrdersPage";
import SiteDashboardPage from "./components/SiteDashboard/SiteDashboardPage";
import SiteSearchPage from "./components/SiteDashboard/SiteSearchPage";

const Unauthorized = () => {
  return (
    <div className="pt-40 grid place-items-center px-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <svg
            className="w-16 h-16 text-red-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
          Access Denied
        </h1>
        <p className="text-gray-400">
          You are not authorized to access this page.
        </p>
        <a
          href="/"
          className="inline-block mt-4 px-6 py-2 bg-pink-600 text-black rounded-lg hover:bg-pink-700 hover:text-pink-600 transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, allowedRoles, allowNoRoles = false }) => {
  const { accounts } = useMsal();
  const roles = accounts[0]?.idTokenClaims?.roles || [];

  const hasRole = allowedRoles.some((role) => roles.includes(role));
  const hasNoRoles = roles.length === 0 && allowNoRoles;

  if (!hasRole && !hasNoRoles) {
    return <Unauthorized />;
  }

  return children;
};

function App() {
  const { instance, accounts } = useMsal();

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
            <Route
              path="/"
              element={
                <ProtectedRoute
                  allowedRoles={["Engineer", "FieldServices"]}
                  allowNoRoles={true}
                >
                  <HomeLayout />
                </ProtectedRoute>
              }
            />

            {/* <Route path="mistassigntool" element={<MainAssign />}></Route> */}

            {/* <Route
              path="addnewsite"
              element={<AddNewSite siteList={siteList} />}
            ></Route> */}
            <Route
              path="provision"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <ProvAccordian />
                </ProtectedRoute>
              }
            ></Route>
            {/* <Route
              path="step2"
              element={<DeployDHCP siteList={siteList} />}
            ></Route> */}
            <Route
              path="validate"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <Validate />
                </ProtectedRoute>
              }
            ></Route>
            {/* <Route path="ping" element={<Ping />} /> */}
            {/* <Route path="terminallist" element={<TerminalList />} /> */}
            {/* <Route path="devicesearch" element={<SearchPage />} /> */}
            {/* <Route path="/device/:name" element={<DevicePage />} /> */}
            <Route
              path="demobe"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <DemobeStepper />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute
                  allowedRoles={["Engineer", "FieldServices"]}
                  allowNoRoles={true}
                >
                  <UserProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="logs"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <LogsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="workbench"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <MobeBenchTable />
                </ProtectedRoute>
              }
            />
            <Route
              path="managedevices"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <ManageDevicePage />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="opengear"
              element={
                <ProtectedRoute allowedRoles={["Engineer", "FieldServices"]}>
                  <OpengearReports />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <ReportLandingPage />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="networksearch"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <NetworkSearchHome />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="device-search"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <NetworkSearch />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="device-outputs"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <DeviceOutputsBySite />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="topology"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <TopologyView />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="diagrams"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <SiteDiagramsView />
                </ProtectedRoute>
              }
            ></Route>
            <Route
              path="dhcp"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <DHCPSiteSelect />
                </ProtectedRoute>
              }
            />
            <Route
              path="dhcp/:siteCode"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <DHCPManager />
                </ProtectedRoute>
              }
            />
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

            <Route
              path="inventory"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <InventoryScanPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="depot-orders"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <DepotManagerHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="depot/dashboard"
              element={
                <ProtectedRoute allowedRoles={["Engineer" ]}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <ManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="supplier-orders"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <SupplierOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <SiteSearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path=":siteCode/dashboard"
              element={
                <ProtectedRoute allowedRoles={["Engineer"]}>
                  <SiteDashboardPage />
                </ProtectedRoute>
              }
            />
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
