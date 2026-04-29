import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(thisFile);
const projectRoot = path.resolve(scriptsDir, "..");

const sourcePath = path.join(projectRoot, "node_modules", "maplibre-gl", "dist", "maplibre-gl.css");
const destinationPath = path.join(projectRoot, "public", "maplibre-gl.css");

if (!existsSync(sourcePath)) {
  throw new Error(`MapLibre CSS source not found: ${sourcePath}`);
}

mkdirSync(path.dirname(destinationPath), { recursive: true });
copyFileSync(sourcePath, destinationPath);
globalThis.console.log("Synced maplibre-gl.css to public/");
