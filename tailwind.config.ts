import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        spending: "#ef4444",
        bills_fixed: "#f59e0b",
        transfers: "#3b82f6",
        debt: "#8b5cf6",
        income: "#22c55e",
        needs_categorisation: "#94a3b8",
      },
    },
  },
  plugins: [],
};
export default config;
