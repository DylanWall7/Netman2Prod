import React from "react";
import { Link } from "react-router-dom";

export const HomeLayout = () => {
  return (
    <div className="mt-12 px-4">
      <main className="h-full">
        <div className="grid grid-cols-3 grid-rows-6 gap-6 max-w-7xl mx-auto mt-5">
          {/* Card Component */}

          <Link to="/provision" className="col-span-1 row-span-1 group">
            <div
              className="bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700
               transition-all duration-300 ease-in-out transform group-hover:scale-[1.015]
               group-hover:shadow-xl rounded-xl shadow-md p-4 h-full flex items-center border border-transparent
               group-hover:border-pink-400"
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors group-hover:text-pink-700">
                  Provisioning Wizard
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 transition-colors group-hover:text-pink-700">
                  Deploy new sites, DHCP, and Netbox using the provisioning
                  wizard.
                </p>
              </div>
              <div className="ml-4 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:rotate-1">
                <svg
                  fill="#000000"
                  version="1.1"
                  id="Layer_1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 490 490"
                  width="70"
                  height="70"
                >
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g
                    id="SVGRepo_tracerCarrier"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></g>
                  <g id="SVGRepo_iconCarrier">
                    {" "}
                    <g>
                      {" "}
                      <g>
                        {" "}
                        <g>
                          {" "}
                          <path d="M10,372.5h405c2.602-0.001,5.159-1.016,7.071-2.929l65-65c1.912-1.913,2.904-4.47,2.905-7.071H490v-245 c0-5.522-4.477-10-10-10H10c-5.523,0-10,4.478-10,10v310C0,368.022,4.477,372.5,10,372.5z M425,338.357V307.5h30.858L425,338.357 z M20,62.5h450v225h-55c-5.523,0-10,4.478-10,10v55H20V62.5z"></path>{" "}
                          <path d="M350,92.5H250c-5.523,0-10,4.478-10,10v15h-25c-5.523,0-10,4.478-10,10v75h-80v-35h55c5.523,0,10-4.478,10-10v-60 c0-5.522-4.477-10-10-10H60c-5.523,0-10,4.478-10,10v60c0,5.522,4.477,10,10,10h45v45c0,5.522,4.477,10,10,10h90v70 c0,5.522,4.477,10,10,10h25v10c0,5.522,4.477,10,10,10h100c5.523,0,10-4.478,10-10v-50c0-5.522-4.477-10-10-10H250 c-5.523,0-10,4.478-10,10v20h-15v-60h15v10c0,5.522,4.477,10,10,10h100c5.523,0,10-4.478,10-10v-50c0-5.522-4.477-10-10-10H250 c-5.523,0-10,4.478-10,10v20h-15v-65h15v15c0,5.522,4.477,10,10,10h100c5.523,0,10-4.478,10-10v-50 C360,96.978,355.523,92.5,350,92.5z M70,147.5v-40h100v40H70z M260,272.5h80v30h-80V272.5z M260,192.5h80v30h-80V192.5z M340,142.5h-80v-30h80V142.5z"></path>{" "}
                          <rect x="50" y="247.5" width="75" height="20"></rect>{" "}
                          <rect x="50" y="277.5" width="75" height="20"></rect>{" "}
                          <rect x="50" y="307.5" width="130" height="20"></rect>{" "}
                          <rect x="135" y="247.5" width="20" height="20"></rect>{" "}
                          <rect x="380" y="92.5" width="25" height="20"></rect>{" "}
                          <rect x="420" y="92.5" width="25" height="20"></rect>{" "}
                          <rect x="380" y="122.5" width="25" height="20"></rect>{" "}
                          <rect x="420" y="122.5" width="25" height="20"></rect>{" "}
                          <rect x="380" y="152.5" width="25" height="20"></rect>{" "}
                          <rect x="420" y="152.5" width="25" height="20"></rect>{" "}
                          <rect x="380" y="182.5" width="25" height="20"></rect>{" "}
                          <rect x="420" y="182.5" width="25" height="20"></rect>{" "}
                          <path d="M483.162,408.013l-60-20c-1.033-0.344-2.1-0.498-3.162-0.498V387.5H10c-5.523,0-10,4.478-10,10v40 c0,5.522,4.477,10,10,10h410h0.001c1.061,0,2.129-0.169,3.161-0.513l60-20c4.083-1.361,6.838-5.183,6.838-9.487 C490,413.196,487.246,409.374,483.162,408.013z M60,427.5H20v-20h40V427.5z M410,427.5H80v-20h330V427.5z M430,423.626v-12.252 l18.377,6.126L430,423.626z"></path>{" "}
                        </g>{" "}
                      </g>{" "}
                    </g>{" "}
                  </g>
                </svg>
              </div>
            </div>
          </Link>

          <Link
            to="https://dhcp.kiewitplaza.com"
            target="_blank"
            className="col-span-1 row-span-1 group"
          >
            <div
              className="bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700
               transition-all duration-300 ease-in-out transform group-hover:scale-[1.015]
               group-hover:shadow-xl rounded-xl shadow-md p-4 h-full flex items-center border border-transparent
               group-hover:border-pink-400"
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors group-hover:text-pink-700">
                  DHCP Tool
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 transition-colors group-hover:text-pink-700">
                  Manage DHCP reservations easily and efficiently.
                </p>
              </div>
              <div className="ml-4 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:rotate-1">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 48 48"
                  enable-background="new 0 0 48 48"
                  id="Layer_3"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="#000000"
                >
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g
                    id="SVGRepo_tracerCarrier"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></g>
                  <g id="SVGRepo_iconCarrier">
                    <path
                      d="M18.979,4.661c-2.212,0.573-4.284,1.494-6.129,2.735L9.857,4.402l-5.656,5.657l3.042,3.042 c-1.163,1.784-2.036,3.766-2.583,5.883H0v10.031h4.66c0.56,2.165,1.458,4.193,2.66,6.009l-3.118,3.118l5.656,5.656l3.119-3.118 c1.819,1.205,3.853,2.104,6.023,2.664V48h4.062v-8.047C14.665,39.465,8,32.52,8,24c0-8.521,6.665-15.465,15.062-15.953V0h-4.083 V4.661z"
                      fill="#241F20"
                    ></path>
                    <path
                      d="M15,24c0,4.654,3.532,8.482,8.062,8.951v-4.046C20.75,28.466,19,26.44,19,24c0-2.44,1.75-4.466,4.062-4.905 v-4.046C18.532,15.518,15,19.346,15,24z"
                      fill="#241F20"
                    ></path>
                    <polygon
                      fill="#241F20"
                      points="36.957,2.026 36.957,0 26,0 26,8 36.957,8 36.957,6 43.936,6 43.936,40 26,40 26,42 26,43.334 26,48 47.936,48 47.936,2.026 "
                    ></polygon>
                    <polygon
                      fill="#241F20"
                      points="40.427,18.644 35.845,23.225 35.854,23.231 29.607,29.478 26,25.869 26,29.351 28.653,32.003 28.646,32.011 29.59,32.951 29.597,32.946 29.603,32.951 30.023,32.533 30.026,32.535 37.593,24.971 42.172,20.39 "
                    ></polygon>
                  </g>
                </svg>
              </div>
            </div>
          </Link>

          <Link
            to="https://mistviewer.kiewitplaza.com"
            target="_blank"
            className="col-span-1 row-span-1 group"
          >
            <div
              className="bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700
               transition-all duration-300 ease-in-out transform group-hover:scale-[1.015]
               group-hover:shadow-xl rounded-xl shadow-md p-4 h-full flex items-center border border-transparent
               group-hover:border-pink-400"
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors group-hover:text-pink-700">
                  Mist Viewer
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 transition-colors group-hover:text-pink-700">
                  View Mist devices and monitor their real-time status.
                </p>
              </div>
              <div className="ml-4 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:rotate-1">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 1024 1024"
                  class="icon"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="#000000"
                >
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g
                    id="SVGRepo_tracerCarrier"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></g>
                  <g id="SVGRepo_iconCarrier">
                    <path
                      d="M464.8 409.7C431.9 365 378.9 336 319.2 336c-99.8 0-180.7 80.9-180.7 180.7s80.9 180.7 180.7 180.7h297.3c149.3 0 270.3-121 270.3-270.3s-121-270.3-270.3-270.3c-118.7 0-219.6 76.5-255.9 183"
                      fill="#FFFFFF"
                    ></path>
                    <path
                      d="M823.5 766.5c0-3.2 0.5-6.3 1.5-9.2H631V417.4c0-5.5-4.5-10-10-10s-10 4.5-10 10v359.9h214.6c-1.3-3.3-2.1-7-2.1-10.8z"
                      fill="#000000"
                    ></path>
                    <path
                      d="M230.2 791.7c-3.5-8.7-12-14.9-22-14.9-13.1 0-23.7 10.6-23.7 23.7s10.6 23.7 23.7 23.7c9.5 0 17.7-5.6 21.5-13.7 1.4-3 2.2-6.4 2.2-10 0-3.1-0.6-6.1-1.7-8.8z"
                      fill="#E6E6E6"
                    ></path>
                    <path
                      d="M852.2 737.9c-12.6 0-23.3 8.1-27.1 19.4-1 2.9-1.5 6-1.5 9.2 0 3.8 0.7 7.4 2.1 10.8 4.3 10.5 14.5 17.9 26.6 17.9 15.8 0 28.7-12.8 28.7-28.7-0.1-15.8-13-28.6-28.8-28.6zM700 257.7c2.1-5.1-0.3-11-5.4-13.1-78-32.3-135.3-15.6-169.6 4.1-37.2 21.3-55.7 50.2-56.4 51.5-2.9 4.7-1.5 10.8 3.1 13.8 1.7 1 3.5 1.5 5.3 1.5 3.3 0 6.6-1.6 8.5-4.6 0.2-0.3 17.1-26.4 50.2-45.2 44.1-24.9 94.9-25.8 151.2-2.5 5.1 2 11-0.4 13.1-5.5z"
                      fill="#000000"
                    ></path>
                    <path
                      d="M852.2 819.8c-12.4 0-22.9 7.8-26.9 18.8H534.5V717.3H611v-40h-76.5V537.9c0-5.5-4.5-10-10-10s-10 4.5-10 10v139.4h-66.9V537.9c0-5.5-4.5-10-10-10s-10 4.5-10 10v139.4H319.2c-88.6 0-160.7-72.1-160.7-160.7s72.1-160.7 160.7-160.7c50.9 0 99.3 24.5 129.5 65.6 6.5 8.9 19.1 10.8 28 4.3 8.9-6.5 10.8-19.1 4.3-28-18.3-24.8-42.4-45.4-69.7-59.5-7.9-4.1-16.1-7.7-24.5-10.7 39.3-91 129.3-150.8 229.8-150.8 138 0 250.3 112.3 250.3 250.3 0 133.1-104.4 242.2-235.7 249.8V717c72.1-3.5 139.3-33.3 190.7-84.7 54.8-54.8 85-127.7 85-205.2s-30.2-150.4-85-205.2c-54.8-54.8-127.7-85-205.2-85-118.8 0-224.9 72.1-269.1 181.2-9.3-1.3-18.8-2-28.2-2-110.7 0-200.7 90-200.7 200.7s90 200.7 200.7 200.7h108.4v73.9H250.9c-4.3-19.6-21.8-34.4-42.7-34.4-24.1 0-43.7 19.6-43.7 43.7s19.6 43.7 43.7 43.7c20.4 0 37.6-14.1 42.4-33h197v-93.9h66.9v141.3h310.9c4.1 10.8 14.6 18.5 26.8 18.5 15.8 0 28.7-12.8 28.7-28.7 0-16-12.9-28.8-28.7-28.8z m-622.5-9.3c-3.8 8.1-12 13.7-21.5 13.7-13.1 0-23.7-10.6-23.7-23.7s10.6-23.7 23.7-23.7c9.9 0 18.5 6.2 22 14.9 1.1 2.7 1.7 5.7 1.7 8.8 0 3.6-0.8 7-2.2 10z"
                      fill="#000000"
                    ></path>
                  </g>
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HomeLayout;
