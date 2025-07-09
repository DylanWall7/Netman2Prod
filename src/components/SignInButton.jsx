import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { Button, ButtonGroup } from "@nextui-org/react";
function handleLogin(instance) {
  instance.loginRedirect(loginRequest).catch((e) => {
    console.error(e);
    // instance.aquireTokenRedirect(loginRequest);
    // localStorage.setItem("msal.idtoken", e);
  });
}

/**
 * Renders a button which, when selected, will redirect the page to the login prompt
 */
export const SignInButton = () => {
  const { instance } = useMsal();

  return (
    // <Button
    //   variant="secondary"
    //   className="ml-auto"
    //   onClick={() => handleLogin(instance)}
    // >
    //   Sign in
    // </Button>
    <Button
      onClick={() => handleLogin(instance)}
      className="ml-auto bg-yellow-400 text-black hover:bg-yellow-300 font-medium px-5 py-2 rounded-xl shadow-md transition"
    >
      Sign in
    </Button>
  );
};
