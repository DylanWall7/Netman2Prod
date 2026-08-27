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
      keyframes: {
        blink: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.2 },
        },
        bounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10%)" },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
        iconPop: {
          "0%": { transform: "scale(0.5)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        modalIn: {
          "0%": { transform: "scale(0.96)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
      },

      animation: {
        blink: "blink 10s infinite",
        bounceOnce: "bounce 1s ease-in-out 4",
        pulse10s: "pulse 2s ease-in-out 5",
        iconPop: "iconPop 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        fadeIn: "fadeIn 200ms ease-out",
        modalIn: "modalIn 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      },

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
  plugins: [
    nextui({}),
    function ({ addVariant }) {
      addVariant("tv", ":fullscreen &");
    },
  ],
};
