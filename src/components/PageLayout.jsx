import React from "react";

import { useIsAuthenticated } from "@azure/msal-react";
import { SignInButton } from "./SignInButton";
import { SignOutButton } from "./SignOutButton";
import { useMsal } from "@azure/msal-react";

import { Link } from "react-router-dom";

import "./User.css";

export const PageLayout = (props) => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  const name = accounts[0] && accounts[0].name;

  return (
    <div>
      <nav className="w-full bg-pink-700 text-pink-400 shadow-md">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex-shrink-0 text-md sm:text-xl font-bold">
              Netman 2: Network Engineering Tools
            </div>

            <div className=" flex items-center space-x-4 ml-auto sm:flex ">
              {[
                { to: "/", label: "Home" },
                { to: "/provision", label: "Provisioning" },
                { to: "/demobe", label: "Demobe" },
                { to: "/validate", label: "Validation" },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="relative text-pink-400 hover:text-white transition hover:scale-105"
                >
                  <span className="after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-white after:transition-all after:duration-300 hover:after:w-full">
                    {label}
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-4 ml-auto">
              {isAuthenticated && (
                <div className="text-sm">
                  Signed in as:{" "}
                  <Link
                    to="/profile"
                    className="font-semibold hover:text-white"
                  >
                    {name}
                  </Link>
                </div>
              )}
              {isAuthenticated ? <SignOutButton /> : <SignInButton />}
            </div>
          </div>
        </div>
      </nav>

      {props.children}
    </div>
  );
};
