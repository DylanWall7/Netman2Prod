import React from "react";
import { useMsal } from "@azure/msal-react";
import { Button, ButtonGroup } from "@nextui-org/react";
function handleLogout(instance) {
  instance.logoutRedirect().catch((e) => {
    console.error(e);
  });
}

/**
 * Renders a button which, when selected, will redirect the page to the logout prompt
 */
export const SignOutButton = () => {
  const { instance } = useMsal();

  return (
    // <Button
    //   variant="secondary"
    //   className="ml-auto"
    //   onClick={() => handleLogout(instance)}
    // >
    //   Sign out
    // </Button>
    <button
      onClick={() => handleLogout(instance)}
      className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-800 text-white font-medium 
             shadow-md border border-gray-700 
             hover:bg-gray-700 hover:shadow-lg hover:scale-105 
             active:scale-95 active:shadow-inner 
             transition-all duration-200 ease-in-out"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7"
        />
      </svg>
      Sign out
    </button>
  );
};
