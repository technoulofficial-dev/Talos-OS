/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Linear (MVE) design system — applied via scripts/apply-design-system.js
        "linear-bg": {
          DEFAULT: "#08090A",
          subtle: "#0D0E10",
          elevated: "#161719",
          overlay: "#1B1C1F",
        },
        "linear-border": {
          DEFAULT: "#22232680",
          subtle: "#1A1B1E",
          strong: "#2A2B2F",
        },
        "linear-text": {
          DEFAULT: "#F7F8F8",
          secondary: "#B4B8BE",
          tertiary: "#62666D",
          disabled: "#3D4046",
          accent: "#5E6AD2",
        },
        "linear-accent": {
          DEFAULT: "#5E6AD2",
          hover: "#7170FF",
          secondary: "#9F8FEF",
        },
        "linear-status": {
          success: "#4CB782",
          warning: "#E2B203",
          danger: "#EB5757",
          info: "#3D8BFD",
        },

        // Bronze-Punk palette
        gunmetal: {
          50: "#2a2a2a",
          100: "#262626",
          200: "#222222",
          300: "#1e1e1e",
          400: "#1a1a1a",
          500: "#161616",
          600: "#121212",
          700: "#0e0e0e",
          800: "#0a0a0a",
          900: "#060606",
        },
        bronze: {
          50: "#fdf8f0",
          100: "#f5e6cc",
          200: "#e8c98a",
          300: "#cd7f32",
          400: "#b87333",
          500: "#a0651f",
          600: "#7d4d12",
          700: "#5a3608",
          800: "#3d2404",
          900: "#1f1202",
        },
        cyan: {
          400: "#22e5ff",
          500: "#00e5ff",
          600: "#00b8cc",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Cinzel", "serif"],
      },
      animation: {
        "scan-line": "scan-line 8s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "flicker": "flicker 3s linear infinite",
      },
      keyframes: {
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px #00e5ff, 0 0 10px #00e5ff" },
          "50%": { boxShadow: "0 0 10px #00e5ff, 0 0 20px #00e5ff, 0 0 30px #00e5ff" },
        },
        flicker: {
          "0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100%": {
            opacity: "1",
            textShadow: "0 0 4px #00e5ff, 0 0 11px #00e5ff, 0 0 19px #00e5ff",
          },
          "20%, 21.999%, 63%, 63.999%, 65%, 69.999%": {
            opacity: "0.6",
            textShadow: "none",
          },
        },
      },
    },
  },
  plugins: [],
};