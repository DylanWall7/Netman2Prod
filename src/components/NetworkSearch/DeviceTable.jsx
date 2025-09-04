// src/components/DeviceTable.jsx
import { useNavigate } from "react-router-dom";

export default function DeviceTable({ devices }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto mt-4">
      <table className="min-w-full text-sm text-left text-gray-300">
        <thead className="bg-gray-800 text-gray-200 uppercase">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">IP Address</th>
            <th className="px-4 py-2">Location</th>
            <th className="px-4 py-2">Model</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr
              key={device.id}
              onClick={() => navigate(`/device/${device.name}`)}
              className="bg-gray-900 hover:bg-gray-700 cursor-pointer transition"
            >
              <td className="px-4 py-2">{device.name}</td>
              <td className="px-4 py-2">{device.ip}</td>
              <td className="px-4 py-2">{device.location}</td>
              <td className="px-4 py-2">{device.model}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
