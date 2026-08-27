import React from "react";
import { useLocation } from "react-router-dom";

export const NoMatch = () => {
  const { pathname } = useLocation();

  return (
    <div className="pt-24 sm:pt-32 pb-20 px-4 flex flex-col items-center text-center">
      <div className="w-full max-w-md">
        <h1 className="text-7xl sm:text-8xl font-bold text-gray-100 tracking-tight leading-none">
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold text-gray-100">
          No route to host
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          The path you requested doesn't resolve to anything on this network.
          It may have been renamed, decommissioned, or never existed.
        </p>

        <div className="mt-8 rounded-lg border border-gray-700 bg-gray-900/60 text-left overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <span className="font-mono text-xs uppercase tracking-wide text-gray-500">
              Route lookup
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-red-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              unreachable
            </span>
          </div>
          <div className="px-4 py-3 font-mono text-xs space-y-1.5">
            <div className="flex gap-3">
              <span className="text-gray-500 shrink-0 w-20">requested</span>
              <span className="text-gray-300 break-all">{pathname}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-gray-500 shrink-0 w-20">status</span>
              <span className="text-red-400">404 not found</span>
            </div>
          </div>
        </div>

        <a
          href="/"
          className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-pink-600 text-black text-sm font-semibold transition-colors hover:bg-pink-700 hover:text-pink-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
        >
          Return to Home
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  );
};