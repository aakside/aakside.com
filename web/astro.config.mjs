// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders, svgoOptimizer } from "astro/config";
import expressiveCode from "astro-expressive-code";
import pagefind from "astro-pagefind";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";

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

/**
 * Dev-only Astro integration serving `/media/*` from the `media/` directory.
 *
 * Video lives outside `public/` so Astro never copies it into `dist/`, where
 * Cloudflare's 25 MiB per-asset limit would reject it. In a real build the
 * <Video> component resolves URLs to R2, but a dev run without credentials
 * falls back to `/media/*` paths, and nothing would serve them otherwise.
 *
 * @returns {import('astro').AstroIntegration}
 */
function serveMediaInDev() {
  return {
    name: "serve-media-in-dev",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const mediaDir = path.resolve(server.config.root, "media");

        server.middlewares.use((req, res, next) => {
          const requestPath = decodeURIComponent(req.url?.split("?")[0] ?? "");
          if (!requestPath.startsWith("/media/")) {
            next();
            return;
          }

          const absolutePath = path.resolve(mediaDir, requestPath.replace(/^\/media\//, ""));
          if (!absolutePath.startsWith(mediaDir) || !existsSync(absolutePath)) {
            next();
            return;
          }

          res.setHeader("Content-Type", mediaContentTypes[path.extname(absolutePath)] ?? "");
          createReadStream(absolutePath).pipe(res);
        });
      },
    },
  };
}

/** @type {Record<string, string>} */
const mediaContentTypes = {
  ".mkv": "video/x-matroska",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// https://astro.build/config
export default defineConfig({
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },

  fonts: [
    {
      provider: fontProviders.adobe({ id: "oft2wtu" }),
      name: "Myriad Pro",
      cssVariable: "--font-myriad-pro",
    },
  ],

  image: {
    // Link-preview scrapers do not render SVG.
    dangerouslyProcessSVG: true,
  },

  integrations: [
    expressiveCode(),
    mdx(),
    sitemap(),
    svelte(),
    pagefind(),
    serveBuiltAstroImagesInDev(),
    serveMediaInDev(),
  ],

  site: "https://aakside.com",

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      noExternal: ["@lucide/svelte"],
    },
    ssr: {
      noExternal: ["@lucide/svelte"],
    },
  },
});
