import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { GizmoRequest } from "../authConfig";

import { authApi } from "../http-common";

export function ReactQTest() {
  const { instance, accounts } = useMsal();

  const { isLoading, error, data, isFetching, refetch } = useQuery({
    queryKey: ["repoData"],
    refetchOnWindowFocus: false,

    queryFn: async () => {
      const request = {
        ...GizmoRequest,
        account: accounts[0],
      };
      const tokenGood = await instance
        .acquireTokenSilent(request)
        .then((response) => {
          Promise.resolve(response.accessToken);
          return response.accessToken;
        });
      const res = await authApi.get(
        `https://${process.env.REACT_APP_API_BASEURL}/api/device/cisco?filter[name]=khone&paginate=10&fields[devices]=name,model,serial,id,ip`,
        {
          headers: {
            Authorization: `Bearer ${tokenGood}`,
          },
        }
      );

      return res.data;
    },
  });

  if (isLoading) return "Loading...";

  if (error) return "An error has occurred: " + error.message;

  return (
    <div>
      {data.data.map((device) => (
        <div class="overflow-x-auto max-w-2xl ml-11 self-center">
          <table class="min-w-full divide-y-1 divide-gray-200 text-sm">
            <thead>
              <tr>
                <th class="max-w-3 whitespace-nowrap px-4 py-2 text-center font-medium text-gray-900">
                  Name
                </th>
                <th class=" max-w-4 whitespace-nowrap px-4 py-2 text-center font-medium text-gray-900 ">
                  Modal #
                </th>
                <th class="whitespace-nowrap px-4 py-2 text-center font-medium text-gray-900">
                  Serial #
                </th>
                <th class="whitespace-nowrap px-4 py-2 text-center font-medium text-gray-900">
                  Device IP
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-gray-200 justify-center ">
              <tr>
                <td class="whitespace-nowrap px-4 py-2 text-center text-gray-900">
                  {device.name}
                </td>
                <td class="whitespace-nowrap px-4 py-2 text-gray-700">
                  {device.model}
                </td>
                <td class="whitespace-nowrap px-4 py-2 text-gray-700">
                  {device.serial}
                </td>
                <td class="whitespace-nowrap px-4 py-2 text-gray-700">
                  {device.ip}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
