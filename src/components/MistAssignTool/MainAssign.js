import React from "react";
import { Button } from "react-bootstrap";
import { Input } from "@nextui-org/react";

import { Outlet, Link, Route, useSearchParams } from "react-router-dom";

const MainProv = ({ siteList }) => {
  console.log(siteList);
  const [invData, setInvData] = React.useState("");
  const [userInput1, setUserInput1] = React.useState("");
  const [userInput2, setUserInput2] = React.useState("");
  const [userInput3, setUserInput3] = React.useState("");
  const [userInput4, setUserInput4] = React.useState("");

  function addDevice() {
    console.log("add device");
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        Authorization:
          "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZjg5ZDYzNmM3ZjE5MDA3YzZiODYyMTY4ODY0NGM3MzA1Mjk5ZTZlYjRlZDQ2NzQ0MTNhM2QzZjc0ZDcxZjAzYjg1M2I5NDgzZDMwYmZiNTEiLCJpYXQiOjE3MjU0NTY1MjAuOTEwNzIzLCJuYmYiOjE3MjU0NTY1MjAuOTEwNzI4LCJleHAiOjIxOTg3NTU3MjAuODM4ODk1LCJzdWIiOiIxIiwic2NvcGVzIjpbXX0.URxh1N4rJfAKVdkX4eR3iWAZZnt-7j3ozcc_HuLfNH4-6P8ktX-jFKlx7nUWtq1-kOj7tarMZjzNjtFDpBdl0KWRRYFnl-ivoTCk0jVGnPnFwc6dLGNQmHvcVG4JHP0vaw39MnUg7DX_M_bk6ExP2kOZ59fLTJRbiElY5jQhr_IANza7UQF1P9_3r9PCncEjCH1PugFrhy-rB-oZbxJ1yzRPs1pjhEbzow0IeJbHpk_psDM7kCDzD5wlvqZZSmHguz03PPmYj3C4HroyKu3nhZvi6Op5U5Xz8iKr31FO6VqFycIGOH6ejiSrJen-nqwsPDES3GbZrKbPDLY_-wLHCOy9ZN1NAz1Nt2gy-qniWi1_LJhIBVf2X-TZiJC5GFFcOH4S9APIBcq-5UEjuC7iWokq5qHi33GTSacKAuzvLg2pL4wBHv75BLGzMcQ63TS_YVd_PhBkDVH2qRojffXagAnI6YxngSMnvEGbLauQrZvYdMbcJ9Doogb36zUmKDHWalxKeOj3Z2Kn_2G2nCAWRvy_CDzNuoarF8fxllclGZSYXM89xIdpq39p7ZUyMdH1lTU1K3zLve2C3XDB2O1Jz5EheWARDNecfhpjB_EEvI_z9bFdt_9PN-2QSgiID-iUU8m59qVHr8hxFI0cnkIVFF2V_AFjsxsbTmXtKs6PWTc",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        archived: false,
        warranty_months: null,
        depreciate: false,
        supplier_id: null,
        requestable: false,
        rtd_location_id: null,
        model_id: userInput3,
        status_id: userInput2,
        asset_tag: userInput1,
        location_id: userInput4,
      }),
    };

    fetch("http://10.123.123.14/api/v1/hardware", options)
      .then((response) => response.json())
      .then((response) => console.log(response))
      .catch((err) => console.error(err));
  }

  function getInvData() {
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",

        Authorization:
          "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZjg5ZDYzNmM3ZjE5MDA3YzZiODYyMTY4ODY0NGM3MzA1Mjk5ZTZlYjRlZDQ2NzQ0MTNhM2QzZjc0ZDcxZjAzYjg1M2I5NDgzZDMwYmZiNTEiLCJpYXQiOjE3MjU0NTY1MjAuOTEwNzIzLCJuYmYiOjE3MjU0NTY1MjAuOTEwNzI4LCJleHAiOjIxOTg3NTU3MjAuODM4ODk1LCJzdWIiOiIxIiwic2NvcGVzIjpbXX0.URxh1N4rJfAKVdkX4eR3iWAZZnt-7j3ozcc_HuLfNH4-6P8ktX-jFKlx7nUWtq1-kOj7tarMZjzNjtFDpBdl0KWRRYFnl-ivoTCk0jVGnPnFwc6dLGNQmHvcVG4JHP0vaw39MnUg7DX_M_bk6ExP2kOZ59fLTJRbiElY5jQhr_IANza7UQF1P9_3r9PCncEjCH1PugFrhy-rB-oZbxJ1yzRPs1pjhEbzow0IeJbHpk_psDM7kCDzD5wlvqZZSmHguz03PPmYj3C4HroyKu3nhZvi6Op5U5Xz8iKr31FO6VqFycIGOH6ejiSrJen-nqwsPDES3GbZrKbPDLY_-wLHCOy9ZN1NAz1Nt2gy-qniWi1_LJhIBVf2X-TZiJC5GFFcOH4S9APIBcq-5UEjuC7iWokq5qHi33GTSacKAuzvLg2pL4wBHv75BLGzMcQ63TS_YVd_PhBkDVH2qRojffXagAnI6YxngSMnvEGbLauQrZvYdMbcJ9Doogb36zUmKDHWalxKeOj3Z2Kn_2G2nCAWRvy_CDzNuoarF8fxllclGZSYXM89xIdpq39p7ZUyMdH1lTU1K3zLve2C3XDB2O1Jz5EheWARDNecfhpjB_EEvI_z9bFdt_9PN-2QSgiID-iUU8m59qVHr8hxFI0cnkIVFF2V_AFjsxsbTmXtKs6PWTc",
      },
    };

    fetch("http://10.123.123.14/api/v1/hardware", options)
      .then((response) => response.json())
      .then((response) => setInvData(response))

      .then((response) => console.log(response))
      .catch((err) => console.error(err));
    console.log(invData);
  }

  return (
    <div className="min-h-full">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"></div>
      </header>

      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          {/* Your content */}
          <Button onClick={getInvData} variant="primary">
            Get Inv
          </Button>

          <div class=" ">
            <div className="border-4 w-3/12 rounded mb-4 p-1 border-gray-500/50 ">
              <th class=" px-2 py-3text-left leading-4 text-gray-800 tracking-wider">
                Provisioning Site List
              </th>
            </div>
            <div>
              <Input
                value={userInput1}
                onChange={(e) => setUserInput1(e.target.value)}
                type="text"
                placeholder="Asset Tag"
              />
              <Input
                value={userInput2}
                onChange={(e) => setUserInput2(e.target.value)}
                type="int"
                placeholder="Status"
              />
              <Input
                value={userInput3}
                onChange={(e) => setUserInput3(e.target.value)}
                type="int"
                placeholder="Model"
              />
              <Input
                value={userInput4}
                onChange={(e) => setUserInput4(e.target.value)}
                type="int"
                placeholder="Location"
              />

              <Button onClick={addDevice} variant="primary">
                Add Device
              </Button>
            </div>

            <table class="w-11/12 border-collapse border border-gray-200 bg-white text-left text-sm text-gray-500">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-1 font-medium text-gray-900">
                    ID
                  </th>
                  <th scope="col" class="px-6 py-1 font-medium text-gray-900">
                    Site Code
                  </th>
                  <th scope="col" class="px-6 py-1 font-medium text-gray-900">
                    Site Name
                  </th>

                  <th
                    scope="col"
                    class="px-6 py-2 font-medium text-gray-900"
                  ></th>
                </tr>
              </thead>
              <div>
                {invData?.rows?.map((inv) => (
                  <tbody class="divide-y divide-gray-100 border-t border-gray-100">
                    <tr>
                      <th class="px-6 py-2 font-medium text-gray-900">
                        {inv.id}
                      </th>
                      <td class="px-6 py-2">
                        {/* <Link to={`${inv.name}`}>{inv.name}</Link> */}
                        {inv.name}
                      </td>
                      <td class="px-6 py-2">{inv.serial}</td>
                    </tr>
                  </tbody>
                ))}
              </div>
              {siteList.map((site) => (
                <tbody class="divide-y divide-gray-100 border-t border-gray-100">
                  <tr>
                    <th class="px-6 py-2 font-medium text-gray-900">id</th>
                    <td class="px-6 py-2">
                      <Link to={`${site.name}`}>{site.name}</Link>
                    </td>
                    <td class="px-6 py-2">{site.name}</td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainProv;
