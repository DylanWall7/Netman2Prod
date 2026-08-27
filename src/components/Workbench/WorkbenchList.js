import React, { useState, useMemo, useRef } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Tooltip,
  Accordion,
  AccordionItem,
} from "@nextui-org/react";
import {
  ClipboardIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import benches from "./benchdata";
import Badge from "../DepotOrders/Badge";

export default function WorkbenchList() {
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [failedKey, setFailedKey] = useState(null);
  const copyTimeoutRef = useRef(null);

  const safeBenches = Array.isArray(benches) ? benches : [];

  const filtered = useMemo(() => {
    return safeBenches.filter(
      (bench) =>
        bench.user?.toLowerCase().includes(search.toLowerCase()) ||
        bench.switch_name?.toLowerCase().includes(search.toLowerCase())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function copyToClipboard(text, key) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFailedKey(null);
      setCopiedKey(key);
    } catch (err) {
      setCopiedKey(null);
      setFailedKey(key);
    }
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedKey(null);
      setFailedKey(null);
    }, 1500);
  }

  function CopyIcon({ copyKey }) {
    const animClass = "w-4 h-4 animate-iconPop motion-reduce:animate-none";
    if (copiedKey === copyKey) {
      return <CheckIcon key="copied" className={`${animClass} text-green-400`} />;
    }
    if (failedKey === copyKey) {
      return <ExclamationTriangleIcon key="failed" className={`${animClass} text-red-400`} />;
    }
    return <ClipboardIcon key="idle" className="w-4 h-4" />;
  }

  return (
    <div className="p-6 text-gray-100">
      <h1 className="text-2xl font-bold mb-4">Workbench Info</h1>

      <Input
        isClearable
        autoFocus
        aria-label="Search by user or switch"
        placeholder="Search by user or switch..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <p className="mt-2 mb-4 text-sm text-gray-500">
        Showing {filtered.length} of {safeBenches.length} benches
      </p>

      <Table
        aria-label="Bench Info Table"
        removeWrapper
        className="rounded-xl overflow-hidden border bg-pink-700 border-gray-700"
      >
        <TableHeader>
          <TableColumn>Rack</TableColumn>
          <TableColumn>User</TableColumn>
          <TableColumn>Console IP</TableColumn>
          <TableColumn>Switch</TableColumn>
          <TableColumn>Subnet</TableColumn>
          <TableColumn>Details</TableColumn>
        </TableHeader>

        <TableBody
          items={filtered}
          emptyContent={
            <span className="animate-fadeIn motion-reduce:animate-none">
              No workbenches match "{search}".
            </span>
          }
        >
          {(bench) => (
            <TableRow
              className="border-b border-gray-700 hover:bg-gray-800/60 transition-colors"
              key={bench.switch_name}
            >
              <TableCell>{bench.rack}</TableCell>
              <TableCell>
                {bench.user === "vacant" ? (
                  <Badge color="gray">Vacant</Badge>
                ) : (
                  bench.user
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {bench.console_ip}
                  <Tooltip content="Copy IP">
                    <Button
                      isIconOnly
                      size="sm"
                      aria-label="Copy console IP"
                      onPress={() =>
                        copyToClipboard(bench.console_ip, `ip-${bench.switch_name}`)
                      }
                      className="bg-gray-700 text-white"
                    >
                      <CopyIcon copyKey={`ip-${bench.switch_name}`} />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
              <TableCell>{bench.switch_name}</TableCell>
              <TableCell>{bench.subnet}</TableCell>
              <TableCell className="w-5/12">
                <Accordion>
                  <AccordionItem
                    key="ports"
                    aria-label="Console Ports"
                    title={<span className="text-gray-100">Show Ports</span>}
                  >
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-100">
                      {bench.console_ports.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-800 p-2 rounded-lg"
                        >
                          <span>{p.port}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">{p.ssh}</span>
                            <a
                              href={`ssh://telecom@${bench.console_ip}:${p.ssh}`}
                              aria-label={`SSH to ${bench.switch_name} ${p.port}`}
                              className="text-pink-500 hover:text-pink-600 hover:underline"
                            >
                              SSH
                            </a>
                            <Tooltip content="Copy address">
                              <Button
                                isIconOnly
                                size="sm"
                                aria-label={`Copy address for ${p.port}`}
                                onPress={() =>
                                  copyToClipboard(
                                    `${bench.console_ip}:${p.ssh}`,
                                    `port-${bench.switch_name}-${p.port}`
                                  )
                                }
                                className="bg-gray-700 text-white"
                              >
                                <CopyIcon copyKey={`port-${bench.switch_name}-${p.port}`} />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                </Accordion>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
