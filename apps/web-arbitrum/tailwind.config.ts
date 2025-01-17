import type { Config } from "tailwindcss";
import { createThemes } from "tw-colors";

const config = {
  darkMode: ["class"],
  content: ["./shadcn/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [createThemes({}), require("tailwindcss-animate")],
} satisfies Config;

export default config;
