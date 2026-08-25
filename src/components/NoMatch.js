import React from "react";
import { MapIcon } from "@heroicons/react/24/outline";

export const NoMatch = () => {
  return (
    <div className="pt-32 pb-20 grid place-items-center px-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
            <MapIcon className="w-8 h-8 text-pink-400" />
          </div>
        </div>

        <h1 className="text-6xl font-bold leading-tight relative inline-block pb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            404
          </span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-100">Page not found</h2>
          <p className="text-sm text-gray-400">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>

        <a
          href="/"
          className="inline-block px-6 py-2 bg-pink-600 text-black rounded-lg hover:bg-pink-700 hover:text-pink-600 transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};
