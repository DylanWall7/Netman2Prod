import React, { useState, useMemo } from "react";
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
import { ClipboardIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

import benches from "./benchdata";

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

export default function MobeBenchTable() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return benches.filter(
      (bench) =>
        bench.user.toLowerCase().includes(search.toLowerCase()) ||
        bench.switch_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Workbench Info</h1>

      <Input
        isClearable
        placeholder="Search by user or switch..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md "
      />

      <Table
        aria-label="Bench Info Table"
        removeWrapper
        className="rounded-xl overflow-hidden shadow-lg border bg-pink-700 border-gray-400"
      >
        <TableHeader>
          <TableColumn>Rack</TableColumn>
          <TableColumn>User</TableColumn>
          <TableColumn>Console IP</TableColumn>
          <TableColumn>Switch</TableColumn>
          <TableColumn>Subnet</TableColumn>
          <TableColumn>Details</TableColumn>
        </TableHeader>

        <TableBody items={filtered}>
          {(bench) => (
            <TableRow className="border-b border-gray-700" key={bench.rack}>
              <TableCell>{bench.rack}</TableCell>
              <TableCell>{bench.user}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {bench.console_ip}
                  <Tooltip content="Copy IP">
                    <Button
                      isIconOnly
                      size="sm"
                      onPress={() => copyToClipboard(bench.console_ip)}
                      className="bg-gray-700 text-white"
                    >
                      <ClipboardIcon className="w-4 h-4" />
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
                    startContent={<ChevronDownIcon className="w-4 h-4" />}
                    title={<span className="text-white">Show Ports</span>}
                  >
                    <div className="grid grid-cols-2 gap-2 text-sm text-white">
                      {bench.console_ports.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-800 p-2 rounded-lg"
                        >
                          <span>{p.port}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">{p.ssh}</span>
                            <a
                              href={`ssh://${bench.console_ip}:${p.ssh}`}
                              className="text-blue-400 hover:underline"
                            >
                              SSH
                            </a>
                            <Button
                              isIconOnly
                              size="sm"
                              onPress={() =>
                                copyToClipboard(`${bench.console_ip}:${p.ssh}`)
                              }
                              className="bg-gray-700 text-white"
                            >
                              <ClipboardIcon className="w-4 h-4" />
                            </Button>
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
