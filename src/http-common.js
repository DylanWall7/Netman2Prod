import axios from "axios";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "./authConfig";

export const authApi = axios.create({
  baseURL: `https://${process.env.REACT_APP_API_BASEURL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const useAuthApi = () => {
  const { instance, accounts } = useMsal();
  const request = {
    ...GizmoRequest,
    account: accounts[0],
  };

  authApi.interceptors.request.use(async (config) => {
    const token = await instance
      .acquireTokenSilent(request)
      .then((response) => {
        return response.accessToken;
      });
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
};
