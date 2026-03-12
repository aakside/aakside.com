import type maplibregl from "maplibre-gl";
import { URLShieldRenderer } from "@americana/maplibre-shield-generator";

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function parseParamId(id: string): { kind: string; params: Record<string, string> } {
  const lines = id.split("\n");
  const kind = lines.shift() ?? "";
  const params: Record<string, string> = {};
  for (const line of lines) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    params[line.slice(0, i)] = line.slice(i + 1);
  }
  return { kind, params };
}

function tintFromBaseImage(
  base: maplibregl.StyleImage,
  rgb: [number, number, number],
): maplibregl.StyleImage {
  const src = base.data;
  const out = new Uint8Array(src.length);
  out.set(src);

  const [tr, tg, tb] = rgb;

  // Heuristic: preserve near-white halo pixels; recolor the rest.
  // (Americana POI icons are typically black glyph + white halo in the sprite.)
  const HALO_THRESHOLD = 235;

  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a === 0) continue;

    const r = out[i + 0];
    const g = out[i + 1];
    const b = out[i + 2];

    if (r >= HALO_THRESHOLD && g >= HALO_THRESHOLD && b >= HALO_THRESHOLD) {
      continue;
    }

    out[i + 0] = tr;
    out[i + 1] = tg;
    out[i + 2] = tb;
  }

  return {
    width: base.width,
    height: base.height,
    data: out,
  };
}

function parseNewlineShieldId(id: string) {
  const lines = id.split("\n");
  if (lines[0] !== "shield") return null;

  const network = (lines[1] ?? "").trim();
  const ref = (lines[2] ?? "").trim();

  const name = lines.slice(3).join("\n").trimEnd();

  if (!network || !ref) return null;
  return { network, ref, name };
}

export function installAmericanaRuntimeAssets(map: maplibregl.Map) {
  const routeShieldParser = {
    parse: (id: string) => {
      const parsed = parseNewlineShieldId(id);
      return parsed ?? { network: "", ref: "", name: "" };
    },
    format: (network: string, ref: string, name: string) =>
      `shield\n${network}\n${ref}\n${name ?? ""}\n`,
  };

  const shieldRenderer = new URLShieldRenderer(
    "https://americanamap.org/shields.json",
    routeShieldParser,
  )
    .filterImageID((imageID: string) => imageID.startsWith("shield\n"))
    .renderOnMaplibreGL(map);

  const generated = new Set<string>();

  const onMissing = (e: any) => {
    const id = e.id as string;

    if (!id.startsWith("poi\n")) return;
    if (generated.has(id)) return;

    const { params } = parseParamId(id);
    const spriteName = params["sprite"];
    const colorHex = params["color"];
    if (!spriteName || !colorHex) return;

    const rgb = hexToRgb(colorHex);
    if (!rgb) return;

    const base = map.getImage(spriteName);
    if (!base) return;

    generated.add(id);

    const tinted = tintFromBaseImage(base, rgb);
    map.addImage(id, tinted.spriteData!, {
      pixelRatio: (base as any).pixelRatio ?? 1,
    });
  };

  map.on("styleimagemissing", onMissing);
  map.on("styledataloading", () => {
    generated.clear();
  });
  return shieldRenderer;
}
