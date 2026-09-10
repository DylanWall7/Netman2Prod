import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// CRA5/webpack 5 dropped the automatic `process` polyfill, but NextUI's shared-utils warn() helper references the bare identifier and crashes without it.
window.process = window.process || { env: {} };

const queryClient = new QueryClient();
const msalInstance = new PublicClientApplication(msalConfig);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
      <ReactQueryDevtools initialisopen={false} />
    </QueryClientProvider>
  </BrowserRouter>
);

// Pass a function to log performance results (e.g. reportWebVitals(console.log)) or send to an analytics endpoint — see https://bit.ly/CRA-vitals
reportWebVitals();
