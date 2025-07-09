import React from "react";

import { useIsAuthenticated } from "@azure/msal-react";
import { SignInButton } from "./SignInButton";
import { SignOutButton } from "./SignOutButton";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { callMsGraph } from "../graph";
import { Link } from "react-router-dom";

import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";

import "./User.css";
import { Nav } from "react-bootstrap";

/**
 * Renders the navbar component with a sign-in button if a user is not authenticated
 */
export const PageLayout = (props) => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();
  const [graphData, setGraphData] = React.useState(null);
  const name = accounts[0] && accounts[0].name;

  const ChevronDown = ({ fill, size, height, width, ...props }) => {
    return (
      <svg
        fill="none"
        height={size || height || 24}
        viewBox="0 0 24 24"
        width={size || width || 24}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="m19.92 8.95-6.52 6.52c-.77.77-2.03.77-2.8 0L4.08 8.95"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeWidth={1.5}
        />
      </svg>
    );
  };

  const Lock = ({ fill, size, height, width, ...props }) => {
    const color = fill;

    return (
      <svg
        height={size || height || 24}
        viewBox="0 0 24 24"
        width={size || width || 24}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <g transform="translate(3.5 2)">
          <path
            d="M9.121,6.653V4.5A4.561,4.561,0,0,0,0,4.484V6.653"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth={1.5}
            transform="translate(3.85 0.75)"
          />
          <path
            d="M.5,0V2.221"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth={1.5}
            transform="translate(7.91 12.156)"
          />
          <path
            d="M7.66,0C1.915,0,0,1.568,0,6.271s1.915,6.272,7.66,6.272,7.661-1.568,7.661-6.272S13.4,0,7.66,0Z"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth={1.5}
            transform="translate(0.75 6.824)"
          />
        </g>
      </svg>
    );
  };

  const Activity = ({ fill, size, height, width, ...props }) => {
    return (
      <svg
        height={size || height || 24}
        viewBox="0 0 24 24"
        width={size || width || 24}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <g
          fill="none"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeWidth={1.5}
        >
          <path d="M6.918 14.854l2.993-3.889 3.414 2.68 2.929-3.78" />
          <path d="M19.668 2.35a1.922 1.922 0 11-1.922 1.922 1.921 1.921 0 011.922-1.922z" />
          <path d="M20.756 9.269a20.809 20.809 0 01.194 3.034c0 6.938-2.312 9.25-9.25 9.25s-9.25-2.312-9.25-9.25 2.313-9.25 9.25-9.25a20.931 20.931 0 012.983.187" />
        </g>
      </svg>
    );
  };

  const Flash = ({ fill = "currentColor", size, height, width, ...props }) => {
    return (
      <svg
        fill="none"
        height={size || height}
        viewBox="0 0 24 24"
        width={size || width}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M6.09 13.28h3.09v7.2c0 1.68.91 2.02 2.02.76l7.57-8.6c.93-1.05.54-1.92-.87-1.92h-3.09v-7.2c0-1.68-.91-2.02-2.02-.76l-7.57 8.6c-.92 1.06-.53 1.92.87 1.92Z"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeWidth={1.5}
        />
      </svg>
    );
  };

  const Server = ({ fill = "currentColor", size, height, width, ...props }) => {
    return (
      <svg
        fill="none"
        height={size || height}
        viewBox="0 0 24 24"
        width={size || width}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M19.32 10H4.69c-1.48 0-2.68-1.21-2.68-2.68V4.69c0-1.48 1.21-2.68 2.68-2.68h14.63C20.8 2.01 22 3.22 22 4.69v2.63C22 8.79 20.79 10 19.32 10ZM19.32 22H4.69c-1.48 0-2.68-1.21-2.68-2.68v-2.63c0-1.48 1.21-2.68 2.68-2.68h14.63c1.48 0 2.68 1.21 2.68 2.68v2.63c0 1.47-1.21 2.68-2.68 2.68ZM6 5v2M10 5v2M6 17v2M10 17v2M14 6h4M14 18h4"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    );
  };

  const TagUser = ({
    fill = "currentColor",
    size,
    height,
    width,
    ...props
  }) => {
    return (
      <svg
        fill="none"
        height={size || height}
        viewBox="0 0 24 24"
        width={size || width}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M18 18.86h-.76c-.8 0-1.56.31-2.12.87l-1.71 1.69c-.78.77-2.05.77-2.83 0l-1.71-1.69c-.56-.56-1.33-.87-2.12-.87H6c-1.66 0-3-1.33-3-2.97V4.98c0-1.64 1.34-2.97 3-2.97h12c1.66 0 3 1.33 3 2.97v10.91c0 1.63-1.34 2.97-3 2.97Z"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeWidth={1.5}
        />
        <path
          d="M12 10a2.33 2.33 0 1 0 0-4.66A2.33 2.33 0 0 0 12 10ZM16 15.66c0-1.8-1.79-3.26-4-3.26s-4 1.46-4 3.26"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    );
  };

  const Scale = ({ fill = "currentColor", size, height, width, ...props }) => {
    return (
      <svg
        fill="none"
        height={size || height}
        viewBox="0 0 24 24"
        width={size || width}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M9 22h6c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7ZM18 6 6 18"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
        <path
          d="M18 10V6h-4M6 14v4h4"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    );
  };

  const icons = {
    chevron: <ChevronDown fill="currentColor" size={16} />,
    scale: <Scale className="text-warning" fill="currentColor" size={30} />,
    lock: <Lock className="text-success" fill="currentColor" size={30} />,
    activity: (
      <Activity className="text-secondary" fill="currentColor" size={30} />
    ),
    flash: <Flash className="text-primary" fill="currentColor" size={30} />,
    server: <Server className="text-success" fill="currentColor" size={30} />,
    user: <TagUser className="text-danger" fill="currentColor" size={30} />,
  };

  function RequestProfileData() {
    const request = {
      ...loginRequest,
      account: accounts[0],
    };

    // Silently acquires an access token which is then attached to a request for Microsoft Graph data
    instance
      .acquireTokenSilent(request)
      .then((response) => {
        callMsGraph(response.accessToken).then((response) =>
          setGraphData(response)
        );
      })
      .catch((e) => {
        instance.acquireTokenPopup(request).then((response) => {
          callMsGraph(response.accessToken).then((response) =>
            setGraphData(response)
          );
        });
      });
  }

  return (
    <div>
      {/* <Navbar className="bg-pink-700 text-pink-400  ">
        <NavbarBrand>
          <p className="font-bold text-inherit">
            Netman 2: Network Engineering Tools
          </p>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-8 " justify="center">
          <NavbarItem>
            <Link color="foreground" to="/" className=" hover:text-gray-300">
              Home
            </Link>
          </NavbarItem>

          <NavbarItem>
            <Link
              color="foreground"
              to="/provision"
              className=" hover:text-gray-300"
            >
              Provisioning
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link
              color="foreground"
              to="/validate"
              className=" hover:text-gray-300"
            >
              Validate Site
            </Link>
          </NavbarItem> */}
      {/* <NavbarItem>
            <Link color="foreground" to="/map" className=" hover:text-gray-300">
              Map
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link
              color="foreground"
              to="/prov"
              className=" hover:text-gray-300"
            >
              Provisioning
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link
              color="foreground"
              to="/device"
              className=" hover:text-gray-300"
            >
              Device Search
            </Link>
          </NavbarItem> */}
      {/* <Dropdown>
            <NavbarItem>
              <DropdownTrigger>
                <Button
                  disableRipple
                  className="p-0 bg-transparent data-[hover=true]:bg-transparent text-pink-400"
                  endContent={icons.chevron}
                  radius="sm"
                  variant="light"
                >
                  Tools
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu
              aria-label="ACME features"
              className="w-[340px] "
              itemClasses={{
                base: "gap-4",
              }}
            >
              <DropdownItem
                key="prov"
                description="ACME scales apps to meet user demand, automagically, based on load."
                startContent={icons.scale}
              >
                <Link to="/prov">Provisioning</Link>
              </DropdownItem>

              <DropdownItem
                key="usage_metrics"
                description="Real-time metrics to debug issues. Slow query added? We’ll show you exactly where."
                startContent={icons.activity}
              >
                Device Search
              </DropdownItem>
              <DropdownItem
                key="production_ready"
                description="ACME runs on ACME, join us and others serving requests at web scale."
                startContent={icons.flash}
              >
                Map
              </DropdownItem>
            </DropdownMenu>
          </Dropdown> */}
      {/* </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <div>
              {isAuthenticated ? (
                <div className="text-pink-400">
                  Signed in as:{" "}
                  <a
                    className="text-pink-400 hover:text-gray-300"
                    href="/profile"
                  >
                    {name}
                  </a>
                </div>
              ) : (
                ""
              )}
            </div>
          </NavbarItem>
          <NavbarItem>
            <div class="lg:flex hidden items-center space-x-2 py-1 px-2 rounded-full">
              {isAuthenticated ? <SignOutButton /> : <SignInButton />}
            </div>
          </NavbarItem>
        </NavbarContent>
      </Navbar> */}
      {/* <Navbar isBordered className="bg-pink-700 text-pink-400  w-full ">
        <NavbarBrand>
          <p className="font-bold text-inherit flex flex-row justify-start items-center gap-2">
            Netman 2: Network Engineering Tools
          </p>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <Link color="foreground" to="/" className=" hover:text-gray-300">
              Home
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link
              aria-current="page"
              color="foreground"
              to="/provision"
              className=" hover:text-gray-300"
            >
              Provisioning
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link
              color="foreground"
              to="/validate"
              className=" hover:text-gray-300"
            >
              Validation
            </Link>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <div>
              {isAuthenticated ? (
                <div className="text-pink-400">
                  Signed in as:{" "}
                  <a
                    className="text-pink-400 hover:text-gray-300"
                    href="/profile"
                  >
                    {name}
                  </a>
                </div>
              ) : (
                ""
              )}
            </div>
          </NavbarItem>
          <NavbarItem>
            <div class="lg:flex hidden items-center space-x-2 py-1 px-2 rounded-full">
              {isAuthenticated ? <SignOutButton /> : <SignInButton />}
            </div>
          </NavbarItem>
        </NavbarContent>
      </Navbar> */}
      <nav className="w-full bg-pink-700 text-pink-400 shadow-md">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            {/* Brand */}
            <div className="flex-shrink-0 text-md sm:text-xl font-bold">
              Netman 2: Network Engineering Tools
            </div>

            {/* Center Links */}
            <div className=" flex items-center space-x-4 ml-auto sm:flex ">
              {[
                { to: "/", label: "Home" },
                { to: "/provision", label: "Provisioning" },
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

            {/* Right Side - User Info + Sign In/Out */}
            <div className="flex items-center space-x-4 ml-auto">
              {isAuthenticated && (
                <div className="text-sm">
                  Signed in as:{" "}
                  <a href="/" className="font-semibold hover:text-white">
                    {name}
                  </a>
                </div>
              )}
              {isAuthenticated ? <SignOutButton /> : <SignInButton />}
            </div>
          </div>
        </div>
      </nav>

      {/* <body>
        <header>
          <nav class="bg-pink-700">
            <div class="container mx-auto py-2 flex justify-between items-center">
              <h1 class="text-2xl font-bold text-pink-400">Dev</h1>
              <div class="flex space-x-10">
                <div class="flex items-center space-x-2">
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-8 w-8 text-pink-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </span>
                  <span class="text-pink-400 hover:text-gray-300">
                    <Link className=" hover:text-gray-300" to="/">
                      Home
                    </Link>
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-8 w-8 text-pink-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </span>
                  <span class="text-pink-400 hover:text-gray-300">
                    <Link className=" hover:text-gray-300" to="/map">
                      Map
                    </Link>
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-8 w-8 text-pink-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                  </span>
                  <span className="text-pink-400 hover:text-gray-300">
                    <Link className=" hover:text-gray-300" to="/prov">
                      Prov
                    </Link>
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-8 w-8 text-pink-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </span>
                  <span class="text-pink-400 hover:text-gray-300">
                    <Link className=" hover:text-gray-300" to="/device">
                      Device Search
                    </Link>
                  </span>
                </div>
              </div>
              <div>
                {isAuthenticated ? (
                  <div className="text-pink-400">
                    Signed in as:{" "}
                    <a
                      className="text-pink-400 hover:text-gray-300"
                      href="/profile"
                    >
                      {name}
                    </a>
                  </div>
                ) : (
                  ""
                )}
              </div>
              <div class="lg:flex hidden items-center space-x-2 py-1 px-2 rounded-full">
                {isAuthenticated ? <SignOutButton /> : <SignInButton />}

              </div>
            </div>
          </nav>
        </header>
      </body> */}
      {/* <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand>Dev Environment</Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse class="flex items-center gap-4">
            <Navbar.Text>
              {isAuthenticated ? (
                <Navbar.Text className="Right">
                  Signed in as: <a href="/profile">{name}</a>
                </Navbar.Text>
              ) : (
                ""
              )}
            </Navbar.Text>
            {isAuthenticated ? <SignOutButton /> : <SignInButton />}
            <ToggleColorMode />
          </Navbar.Collapse>
        </Container>
      </Navbar> */}
      {props.children}
    </div>
  );
};
