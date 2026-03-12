// @ts-check

import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import tailwindcss from "@tailwindcss/vite";

import svelte from "@astrojs/svelte";

import expressiveCode from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
  experimental: {
    fonts: [
      {
        provider: fontProviders.adobe({ id: "oft2wtu" }),
        name: "Myriad Pro",
        cssVariable: "--font-myriad-pro",
      },
    ],
  },
  integrations: [expressiveCode(), mdx(), sitemap(), svelte()],
  markdown: {
    remarkPlugins: [[remarkToc, { heading: "toc", maxDepth: 6 }]],
  },
  site: "https://aakside.com",
  vite: {
    plugins: [tailwindcss()],
  },
});
