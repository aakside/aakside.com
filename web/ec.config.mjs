import { defineEcConfig } from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

export default defineEcConfig({
  frames: {
    showCopyToClipboardButton: false,
  },
  plugins: [pluginCollapsibleSections()],
  themes: ["ayu-mirage"],
});
