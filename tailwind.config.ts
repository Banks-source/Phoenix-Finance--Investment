import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        spending: "#e11d48",
        bills_fixed: "#f59e0b",
        transfers: "#3b82f6",
        debt: "#8b5cf6",
        income: "#059669",
        needs_categorisation: "#94a3b8",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
