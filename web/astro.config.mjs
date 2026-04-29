// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import pagefind from "astro-pagefind";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import remarkToc from "remark-toc";

/**
 * Dev-only Astro integration to make Pagefind UI image previews work during `astro dev`.
 *
 * Why this exists:
 * - `astro-pagefind` search results can contain image URLs that point to built assets under `/_astro/*`.
 * - Those files exist after `astro build` in `dist/_astro`, but are not normally served by the dev server.
 * - Without this middleware, Pagefind result thumbnails can 404 in dev even though they work in preview/production.
 *
 * What it does:
 * - Intercepts requests to `/_astro/*` for known image extensions.
 * - If a matching file exists in `dist/_astro`, streams it with the correct content type.
 * - Falls through to the normal middleware chain when no matching built asset exists.
 *
 * @returns {import('astro').AstroIntegration}
 */
function serveBuiltAstroImagesInDev() {
  let shouldEnable = false;

  return {
    name: "serve-built-astro-images-in-dev",
    hooks: {
      "astro:config:setup": ({ command, config }) => {
        shouldEnable = command === "dev" && config.output === "static";
      },
      "astro:server:setup": ({ server }) => {
        if (!shouldEnable) {
          return;
        }

        const rootPath = server.config.root;
        const distAstroDir = path.join(rootPath, server.config.build.outDir, "_astro");
        /** @type {Record<string, string>} */
        const extToType = {
          ".avif": "image/avif",
          ".gif": "image/gif",
          ".jpeg": "image/jpeg",
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
        };

        server.middlewares.use((req, res, next) => {
          const requestPath = req.url?.split("?")[0] ?? "";
          if (!requestPath.startsWith("/_astro/")) {
            next();
            return;
          }

          const ext = path.extname(requestPath).toLowerCase();
          const contentType = extToType[ext];
          if (!contentType) {
            next();
            return;
          }

          const relativeAssetPath = requestPath.replace(/^\/_astro\//, "");
          const absoluteAssetPath = path.resolve(distAstroDir, relativeAssetPath);
          if (!absoluteAssetPath.startsWith(distAstroDir) || !existsSync(absoluteAssetPath)) {
            next();
            return;
          }

          res.setHeader("Content-Type", contentType);
          createReadStream(absoluteAssetPath).pipe(res);
        });
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  fonts: [
    {
      provider: fontProviders.adobe({ id: "oft2wtu" }),
      name: "Myriad Pro",
      cssVariable: "--font-myriad-pro",
    },
  ],
  integrations: [
    expressiveCode(),
    mdx(),
    sitemap(),
    svelte(),
    pagefind(),
    serveBuiltAstroImagesInDev(),
  ],
  markdown: {
    remarkPlugins: [[remarkToc, { heading: "toc", maxDepth: 6 }]],
  },
  security: {
    csp: {
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'"],
      },
    },
  },
  site: "https://aakside.com",
  vite: {
    plugins: [tailwindcss()],
  },
});
