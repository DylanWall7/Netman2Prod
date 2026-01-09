import React, { useState } from "react";
import {
  WifiIcon,
  TrashIcon,
  ArrowPathIcon,
  PowerIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ServerIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { WifiIcon as WifiSolidIcon } from "@heroicons/react/24/solid";

const DHCPManager = () => {
  const [scopes, setScopes] = useState([
    {
      id: 1,
      scopeId: "10.148.0.0",
      mask: "255.255.252.0",
      name: "EASNY135 VLAN 1 - WIRED",
      start: "10.148.0.50",
      end: "10.148.3.242",
      gateway: "10.148.0.1",
      dns: ["10.148.0.1", "10.251.12.189", "10.251.12.190"],
      domain: "kiewitplaza.com",
      leases: 0,
      reservations: 0,
      status: "active",
      expanded: false,
    },
    {
      id: 2,
      scopeId: "10.148.4.0",
      mask: "255.255.252.0",
      name: "EASNY135 VLAN 5 - WIRELESS",
      start: "10.148.4.10",
      end: "10.148.7.242",
      gateway: "10.148.4.1",
      dns: ["10.148.4.1", "10.251.12.189", "10.251.12.190"],
      domain: "kiewitplaza.com",
      leases: 0,
      reservations: 0,
      status: "active",
      expanded: false,
    },
    {
      id: 3,
      scopeId: "10.148.8.0",
      mask: "255.255.252.0",
      name: "EASNY135 VLAN 9 - VOICE",
      start: "10.148.8.10",
      end: "10.148.11.242",
      gateway: "10.148.8.1",
      dns: ["10.148.8.1", "10.251.12.189", "10.251.12.190"],
      domain: "kiewitplaza.com",
      leases: 0,
      reservations: 0,
      status: "active",
      expanded: false,
    },
    {
      id: 4,
      scopeId: "10.148.12.0",
      mask: "255.255.254.0",
      name: "EASNY135 VLAN 13 - GUEST_PARTNER_JV",
      start: "10.148.12.10",
      end: "10.148.13.244",
      gateway: "10.148.12.1",
      dns: ["10.148.12.1", "10.251.12.189", "10.251.12.190"],
      domain: "kiewitplaza.com",
      leases: 0,
      reservations: 0,
      status: "active",
      expanded: false,
    },
  ]);

  const [selectedScopes, setSelectedScopes] = useState([]);

  const toggleExpand = (id) => {
    setScopes(
      scopes.map((scope) =>
        scope.id === id ? { ...scope, expanded: !scope.expanded } : scope
      )
    );
  };

  const toggleSelect = (id) => {
    setSelectedScopes((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedScopes(
      selectedScopes.length === scopes.length ? [] : scopes.map((s) => s.id)
    );
  };

  const handleBulkAction = async (action) => {
    console.log(`Performing ${action} on scopes:`, selectedScopes);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    alert(`${action} performed on ${selectedScopes.length} scope(s)`);
  };

  const handleScopeAction = async (scopeId, action) => {
    console.log(`Performing ${action} on scope:`, scopeId);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (action === "toggle") {
      setScopes(
        scopes.map((scope) =>
          scope.id === scopeId
            ? {
                ...scope,
                status: scope.status === "active" ? "inactive" : "active",
              }
            : scope
        )
      );
    }
  };

  return (
    <div className="min-h-screen text-gray-100 p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
                  <ServerIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">
                    DHCP Scope Manager
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Manage DHCP scopes for site{" "}
                    <span className="text-cyan-400 font-semibold">
                      EASNY135
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 flex items-center gap-2">
                <PowerIcon className="w-4 h-4" />
                New Scope
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div
          className={`backdrop-blur-xl border rounded-xl p-4 mb-6 flex items-center justify-between transition-all duration-300 ${
            selectedScopes.length > 0
              ? "bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
              : "bg-gray-900/50 border-gray-800/50"
          }`}
        >
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={selectedScopes.length === scopes.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded-lg bg-gray-800 border-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-2 focus:ring-offset-0 transition-all cursor-pointer"
                />
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {selectedScopes.length === 0
                  ? "Select All Scopes"
                  : `${selectedScopes.length} Scope${
                      selectedScopes.length > 1 ? "s" : ""
                    } Selected`}
              </span>
            </label>
          </div>

          <div
            className={`flex items-center gap-2 transition-all duration-300 ${
              selectedScopes.length > 0
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-4 pointer-events-none"
            }`}
          >
            <button
              onClick={() => handleBulkAction("deploy")}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-green-500/25 hover:shadow-green-500/40 flex items-center gap-2 transition-all duration-200 hover:scale-105"
            >
              <PowerIcon className="w-4 h-4" />
              Deploy
            </button>
            <button
              onClick={() => handleBulkAction("refresh")}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center gap-2 transition-all duration-200 hover:scale-105"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-medium shadow-lg shadow-red-500/25 hover:shadow-red-500/40 flex items-center gap-2 transition-all duration-200 hover:scale-105"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Scopes List */}
        <div className="space-y-4">
          {scopes.map((scope) => (
            <div
              key={scope.id}
              className={`backdrop-blur-xl border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl ${
                selectedScopes.includes(scope.id)
                  ? "bg-cyan-500/5 border-cyan-500/40 shadow-lg shadow-cyan-500/10 scale-[1.01]"
                  : "bg-gray-900/50 border-gray-800/50 hover:border-gray-700/70"
              }`}
            >
              {/* Scope Header */}
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.id)}
                      onChange={() => toggleSelect(scope.id)}
                      className="w-5 h-5 rounded-lg bg-gray-800 border-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-2 focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    {/* Scope Info */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            scope.status === "active"
                              ? "bg-green-500/20 ring-1 ring-green-500/30"
                              : "bg-gray-700/50 ring-1 ring-gray-600/30"
                          }`}
                        >
                          {scope.status === "active" ? (
                            <WifiSolidIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <WifiIcon className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <span className="font-mono text-sm font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                          {scope.scopeId}/
                          {scope.mask.split(".").filter((n) => n === "255")
                            .length * 8}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 font-medium">
                        {scope.name}
                      </div>
                    </div>

                    {/* IP Range */}
                    <div className="col-span-3">
                      <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        IP Range
                      </div>
                      <div className="font-mono text-xs text-gray-200 bg-gray-800/50 px-2 py-1 rounded-md">
                        {scope.start} → {scope.end}
                      </div>
                    </div>

                    {/* Gateway */}
                    <div className="col-span-2">
                      <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        Gateway
                      </div>
                      <div className="font-mono text-xs text-gray-200 bg-gray-800/50 px-2 py-1 rounded-md">
                        {scope.gateway}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="col-span-2 flex gap-4">
                      <div className="bg-blue-500/10 rounded-lg px-3 py-2 border border-blue-500/20">
                        <div className="text-xs text-blue-400 font-medium mb-0.5">
                          Leases
                        </div>
                        <div className="text-lg font-bold text-blue-300">
                          {scope.leases}
                        </div>
                      </div>
                      <div className="bg-purple-500/10 rounded-lg px-3 py-2 border border-purple-500/20">
                        <div className="text-xs text-purple-400 font-medium mb-0.5">
                          Reserved
                        </div>
                        <div className="text-lg font-bold text-purple-300">
                          {scope.reservations}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="col-span-1 pl-6 flex justify-end">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                          scope.status === "active"
                            ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 ring-1 ring-green-500/30 shadow-lg shadow-green-500/20"
                            : "bg-gray-700/30 text-gray-400 ring-1 ring-gray-600/30"
                        }`}
                      >
                        {scope.status}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleScopeAction(scope.id, "toggle")}
                      className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 group ${
                        scope.status === "active"
                          ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 ring-1 ring-green-500/30 hover:shadow-lg hover:shadow-green-500/30"
                          : "bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 ring-1 ring-gray-600/30"
                      }`}
                      title={
                        scope.status === "active" ? "Deactivate" : "Activate"
                      }
                    >
                      <PowerIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleScopeAction(scope.id, "refresh")}
                      className="p-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all duration-200 hover:scale-110 ring-1 ring-blue-500/30 hover:shadow-lg hover:shadow-blue-500/30"
                      title="Refresh"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleScopeAction(scope.id, "edit")}
                      className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-all duration-200 hover:scale-110 ring-1 ring-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/30"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleScopeAction(scope.id, "delete")}
                      className="p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all duration-200 hover:scale-110 ring-1 ring-red-500/30 hover:shadow-lg hover:shadow-red-500/30"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(scope.id)}
                      className="p-2.5 bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 rounded-xl transition-all duration-200 hover:scale-110 ring-1 ring-gray-600/30"
                      title="Toggle Details"
                    >
                      {scope.expanded ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {scope.expanded && (
                <div className="border-t border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-900/50 backdrop-blur-sm p-6 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-800/30 rounded-xl p-4 ring-1 ring-gray-700/50">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <div className="p-1.5 bg-cyan-500/20 rounded-lg ring-1 ring-cyan-500/30">
                          <ServerIcon className="w-4 h-4 text-cyan-400" />
                        </div>
                        Network Configuration
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-gray-700/30">
                          <span className="text-gray-400 font-medium">
                            Scope ID:
                          </span>
                          <span className="font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md">
                            {scope.scopeId}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-700/30">
                          <span className="text-gray-400 font-medium">
                            Subnet Mask:
                          </span>
                          <span className="font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md">
                            {scope.mask}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-400 font-medium">
                            Gateway:
                          </span>
                          <span className="font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md">
                            {scope.gateway}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/30 rounded-xl p-4 ring-1 ring-gray-700/50">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/20 rounded-lg ring-1 ring-purple-500/30">
                          <GlobeAltIcon className="w-4 h-4 text-purple-400" />
                        </div>
                        DNS & Domain
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="pb-2">
                          <span className="text-gray-400 font-medium block mb-2">
                            DNS Servers:
                          </span>
                          <div className="space-y-1.5">
                            {scope.dns.map((dns, idx) => (
                              <div
                                key={idx}
                                className="font-mono text-purple-400 text-xs bg-purple-500/10 px-3 py-1.5 rounded-md flex items-center gap-2"
                              >
                                <span className="text-purple-300 font-semibold">
                                  {idx + 1}.
                                </span>
                                {dns}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-700/30">
                          <span className="text-gray-400 font-medium">
                            Domain:
                          </span>
                          <span className="font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                            {scope.domain}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reserved Supernets Info */}
        <div className="mt-8 backdrop-blur-xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-700/50 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl ring-1 ring-cyan-500/30">
              <ServerIcon className="w-5 h-5 text-cyan-400" />
            </div>
            Reserved Supernets - <span className="text-cyan-400">EASNY135</span>
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-800/30 rounded-lg p-4 ring-1 ring-gray-700/50">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium text-sm">
                  Network:
                </span>
                <span className="font-mono text-cyan-400 text-lg font-bold bg-cyan-500/10 px-3 py-1.5 rounded-md">
                  10.148.0.0
                </span>
              </div>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-4 ring-1 ring-gray-700/50">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium text-sm">
                  Bitmask:
                </span>
                <span className="font-mono text-cyan-400 text-lg font-bold bg-cyan-500/10 px-3 py-1.5 rounded-md">
                  /20
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DHCPManager;
