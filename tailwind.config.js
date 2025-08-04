/** @type {import('tailwindcss').Config} */
const { nextui } = require("@nextui-org/react");
const { color } = require("framer-motion");

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pink: {
          100: "#081b2a", //Main Background Color
          200: "#6b7a91", //Light Header Color
          300: "#011423", //Dark Header Color
          400: "#f1f6ff", //Text color
          500: "#3bd6ce", //Link color
          600: "#00f2d7", //Add Button color
          700: "#00222e", //SideBar Color
          800: "#C62828",
          900: "#272729",
        },
      },
    },
  },
  darkMode: "class",
  plugins: [nextui({})],
};
