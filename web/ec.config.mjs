import { defineEcConfig } from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

/**
 * Keeps collapsed code sections out of the Pagefind index.
 *
 * Collapsed lines are still in the DOM — the collapsible-sections plugin only hides them with CSS —
 * so Pagefind indexes them like any other text. That surfaces two kinds of noise: hits on code the
 * reader cannot see without expanding a section, and the summary's own "N collapsed lines" label
 * bleeding into result excerpts.
 *
 * The plugin wraps each collapsed range in an `.ec-section` element holding the summary and the
 * hidden lines, and nothing else — visible lines stay outside it — so marking that element
 * `data-pagefind-ignore` drops exactly the hidden content and keeps the rest of the snippet
 * searchable. Must be registered after `pluginCollapsibleSections()`; Expressive Code runs
 * `postprocessRenderedBlock` in plugin order, and the sections do not exist until it has run.
 *
 * @returns {import('astro-expressive-code').ExpressiveCodePlugin}
 */
function pluginIgnoreCollapsedSectionsInSearch() {
  return {
    name: "IgnoreCollapsedSectionsInSearch",
    hooks: {
      postprocessRenderedBlock: ({ renderData }) => {
        /** @param {any} node */
        const visit = (node) => {
          if (node?.type === "element") {
            const className = node.properties?.className;
            const classes = Array.isArray(className) ? className : [className];
            if (classes.includes("ec-section")) {
              // hast turns `dataPagefindIgnore` into the `data-pagefind-ignore` attribute.
              node.properties.dataPagefindIgnore = true;
            }
          }
          node?.children?.forEach(visit);
        };
        visit(renderData.blockAst);
      },
    },
  };
}

export default defineEcConfig({
  frames: {
    showCopyToClipboardButton: false,
  },
  plugins: [pluginCollapsibleSections(), pluginIgnoreCollapsedSectionsInSearch()],
  themes: ["ayu-mirage"],
});
