// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	experimental: {
		fonts: [{
			provider: fontProviders.adobe({ id: "oft2wtu" }),
			name: "Myriad Pro",
			cssVariable: "--font-myriad-pro"
		}]
	},
  integrations: [mdx(), sitemap()],
  site: "https://aakside.com",
  vite: {
    plugins: [tailwindcss()],
  },
});
