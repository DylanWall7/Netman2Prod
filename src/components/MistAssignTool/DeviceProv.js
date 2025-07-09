import React from "react";
import { useParams, Link } from "react-router-dom";
import { PROVISIONDATA } from "./data";

export const DeviceProv = () => {
  const data = PROVISIONDATA;
  const { deviceName } = useParams();
  const device = PROVISIONDATA.find(
    (device) => device.deviceName === deviceName
  );
  return (
    <div>
      <h1>Device Provisioning</h1>
      <h2>Device Name: {device.deviceName}</h2>
    </div>
  );
};
