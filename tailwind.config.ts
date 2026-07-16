import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        leaf: "#2f6f4e",
        clay: "#b46a4a",
        mist: "#f4f7f2",
      },
    },
  },
  plugins: [],
};

export default config;
