import { Fragment } from "react";

import { Link } from "react-router-dom";

import React, { useState } from "react";
import { Input } from "@nextui-org/react";
import { name } from "@azure/msal-browser/dist/packageMetadata";
import { Button } from "react-bootstrap";

export default function Example(sites) {
  const [devices, setDevices] = useState([{ serialNumber: "", name: "" }]);

  const handleInputChange = (index, event) => {
    const values = [...devices];
    values[index][event.target.name] = event.target.value;
    setDevices(values);
  };

  const handleAddDevice = () => {
    setDevices([...devices, { serialNumber: "", name: "" }]);
  };

  console.log(devices);
  console.log(sites.site.name);

  return (
    <>
      <div className="min-h-full">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {sites.site.name}
            </h1>
            {/* <h6>{sites.site.name}</h6> */}
          </div>
        </header>
        <main>
          <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
            {/* Your content */}

            <>
              <div className=" ">
                <th className=" px-2 py-3 text-left leading-4 text-gray-800 tracking-wider">
                  Mist Device Assign List
                </th>
                {devices.map((device, index) => (
                  <div
                    key={index}
                    className="flex w-1/2 flex-wrap md:flex-nowrap gap-2 m-2"
                  >
                    <Input
                      type="text"
                      size="small"
                      name="serialNumber"
                      value={device.serialNumber}
                      onChange={(event) => handleInputChange(index, event)}
                      placeholder="Serial Number"
                    />
                    <Input
                      type="text"
                      size="small"
                      name="name"
                      value={device.name}
                      onChange={(event) => handleInputChange(index, event)}
                      placeholder="Device Name"
                    />
                  </div>
                ))}
                {devices.length < 500 && (
                  <button
                    className="bg-green-700 hover:bg-green-900 text-white font-bold py-2 px-4 rounded"
                    onClick={handleAddDevice}
                  >
                    Add Device
                  </button>
                )}
              </div>
            </>
          </div>
        </main>
      </div>
    </>
  );
}
