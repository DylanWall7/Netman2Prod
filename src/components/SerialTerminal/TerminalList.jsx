import React from "react";

const devices = [
  {
    id: 1,
    name: "Terminal A",
    ip: "10.82.1.93",
    location: "Data Center 1",
    model: "OM2200",
    serialNumber: "SN123456",
    imei: "351234567890123",
    simIccid: "8901123456789012345",
    wiredIp: "10.130.160.48",
  },
  {
    id: 2,
    name: "Terminal B",
    ip: "10.82.3.205",
    location: "Data Center 2",
    model: "CM7100",
    serialNumber: "SN789012",
    imei: "351987654321098",
    simIccid: "8901987654321098765",
    wiredIp: "10.150.112.48",
  },
];

export default function TerminalList() {
  const handleSSH = (ip) => {
    window.location.href = `ssh://${ip}`;
  };

  const handleWeb = (ip) => {
    window.open(`https://${ip}`, "_blank");
  };

  return (
    <div className="text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Opengear Terminal List</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className=" text-left text-sm uppercase tracking-wider">
              <th className="p-3">ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">IP Address</th>
              <th className="p-3">Location</th>
              <th className="p-3">Model</th>
              <th className="p-3">Serial Number</th>
              <th className="p-3">IMEI</th>
              <th className="p-3">SIM ICCID</th>
              <th className="p-3">Wired IP</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr
                key={device.id}
                className="border-b border-neutral-700 hover:bg-neutral-800 transition"
              >
                <td className="p-3">{device.id}</td>
                <td className="p-3">{device.name}</td>
                <td className="p-3">{device.ip}</td>
                <td className="p-3">{device.location}</td>
                <td className="p-3">{device.model}</td>
                <td className="p-3">{device.serialNumber}</td>
                <td className="p-3">{device.imei}</td>
                <td className="p-3">{device.simIccid}</td>
                <td className="p-3">{device.wiredIp}</td>
                <td className="p-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleSSH(device.ip)}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-md text-sm"
                  >
                    SSH (IP)
                  </button>
                  <button
                    onClick={() => handleWeb(device.ip)}
                    className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-md text-sm"
                  >
                    Web (IP)
                  </button>
                  <button
                    onClick={() => handleSSH(device.wiredIp)}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-md text-sm"
                  >
                    SSH (Wired)
                  </button>
                  <button
                    onClick={() => handleWeb(device.wiredIp)}
                    className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-md text-sm"
                  >
                    Web (Wired)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
