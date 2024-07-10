import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },
  output: "server",
  security: {
    checkOrigin: true,
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    svelte(),
  ],
  adapter: node({
    mode: "standalone",
  }),
});
