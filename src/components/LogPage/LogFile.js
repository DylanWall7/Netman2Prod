import React, { useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@nextui-org/react";

const mockLogs = [
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4879: Device is already assigned to a site in Mist.",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4880: found matching MIST DEVICE with serial 654654654.",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: FAILED to assign device SERIAL:65465465436 to site ID:c2e1fdfd",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4881: found matching MIST DEVICE with serial 654654654.",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4881: Device is already assigned to a site in Mist.",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4882: found matching MIST DEVICE with serial 65465465484.",
  "[2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: NETBOX DEVICE ID 4882: Device is already assigned to a site in Mist.",
];

function parseLog(logLine) {
  // Example log format:
  // [2025-09-16 19:48:46] local.INFO: User1 : deployMistDevices: MESSAGE
  const regex = /^\[(.*?)\]\s.*?:\s(.*?)\s:\s(.*?):\s(.*)$/;
  const match = logLine.match(regex);

  if (!match) {
    return {
      timestamp: "",
      user: "",
      action: "",
      message: logLine,
    };
  }

  return {
    timestamp: match[1],
    user: match[2],
    action: match[3],
    message: match[4],
  };
}

const parsedLogs = mockLogs.map(parseLog);

const getColor = (msg) => {
  if (msg.includes("FAILED")) return "text-red-500 font-semibold";
  if (msg.includes("already assigned")) return "text-yellow-400";
  if (msg.includes("found matching")) return "text-green-400";
  return "text-gray-200";
};

export default function LogsPage() {
  const columns = useMemo(
    () => [
      { key: "timestamp", label: "Timestamp" },
      { key: "user", label: "User" },
      { key: "action", label: "Action" },
      { key: "message", label: "Message" },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4">System Logs</h1>
      <Table
        aria-label="Logs table"
        removeWrapper
        isStriped
        className="rounded-xl overflow-hidden shadow-lg border border-gray-800"
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.key} className="bg-gray-800 text-gray-200">
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={parsedLogs}>
          {(item) => (
            <TableRow key={item.timestamp + item.message}>
              <TableCell>{item.timestamp}</TableCell>
              <TableCell>{item.user}</TableCell>
              <TableCell>{item.action}</TableCell>
              <TableCell className={getColor(item.message)}>
                {item.message}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
