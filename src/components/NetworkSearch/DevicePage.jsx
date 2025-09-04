// src/pages/DevicePage.jsx
import { useParams, Link } from "react-router-dom";
import { devices } from "./data.js";
import { useEffect, useState } from "react";
import JuniperEX3400 from "./JuniperEX3400.jsx";

export default function DevicePage() {
  const { name } = useParams();
  const device = devices.find((d) => d.name === name);

  const [lights, setLights] = useState(
    Array.from({ length: 24 }, () => Math.random() > 0.5)
  );

  // Blink random lights every second
  useEffect(() => {
    const interval = setInterval(() => {
      setLights((prev) => prev.map(() => Math.random() > 0.5));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!device) {
    return (
      <div className=" text-white p-6">
        <h1 className="text-2xl font-bold">Device Not Found</h1>
        <Link to="/devicesearch" className="text-blue-400 underline mt-4 block">
          Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className=" text-white p-6">
      <h1 className="text-3xl font-bold mb-4">{device.name}</h1>
      <ul className="space-y-2 text-lg mb-8">
        <li>
          <strong>IP Address:</strong> {device.ip}
        </li>
        <li>
          <strong>Location:</strong> {device.location}
        </li>
        <li>
          <strong>Model:</strong> {device.model}
        </li>
        <li>
          <strong>Serial Number:</strong> {device.serial}
        </li>
      </ul>
      {/* Switch Mock */}

      <Link to={`/devicesearch`} className="text-blue-400 underline mt-6 block">
        Back to Search
      </Link>
    </div>
  );
}
