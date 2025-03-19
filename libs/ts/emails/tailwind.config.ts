const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./emails/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      lg: "800px",
    },
  },
} satisfies Config;

export default config;
