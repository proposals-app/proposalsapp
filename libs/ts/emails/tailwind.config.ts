import type { Config } from "tailwindcss";

const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./emails/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        luna: "#F1EBE7",
        gold: "#C2AEA2",
        dark: "#2C2927",
        bgdark: "#161413",
      },
    },
  },
} satisfies Config;

export default config;
