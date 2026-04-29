<script lang="ts" module>
  export interface FirstLayerShareConfig extends FirstLayer {
    serdeIndex: number;
  }

  export type ShareConfig = {
    config: FirstLayer | OverlayLayer;
    metadata: {
      name: LayerMetadata["name"];
      osmId?: LayerMetadata["osmId"];
      style?: number; // serdeIndex of the style in the styles array
      nominatimData?: LayerMetadata["nominatimData"];
    };
  }[];
</script>

<script lang="ts">
  import type { FirstLayer, MapState, OverlayLayer } from "@aakside/svelte-maplibre-stack";
  import { Braces, ClipboardCopy, ClipboardType, Link } from "@lucide/svelte";
  import { mapStyles, type LayerMetadata } from "./main.svelte";
  import type { SvelteMap } from "svelte/reactivity";
  import { encodeJsonForUrl } from "../../../utils/url-codec";
  import { untrack } from "svelte";

  interface Props {
    mapState: MapState;
    layersMetadata: SvelteMap<string, LayerMetadata>;
  }

  let { layersMetadata, mapState }: Props = $props();

  type OutputType = "URL" | "JSON";

  const OutputTypes = ["URL", "JSON"];
  let outputType = $state<OutputType>("URL");
  let output = $derived(await getShareOutput());

  async function getShareOutput() {
    const layersConfig = untrack(() => mapState.toLayerConfigs({ includeGeojson: false }));
    const layersExportData: ShareConfig = untrack(() =>
      layersConfig.map((layerConfig: FirstLayer | OverlayLayer, i: number) => {
        const metadata = layersMetadata.get(mapState.layers[i].id)!;
        const styleSerdeIndex = layerConfig.style ? mapStyles.find(
          (style) => style.url === layerConfig.style,
        )?.serdeIndex : undefined;
        return {
          config: styleSerdeIndex ? { ...layerConfig, style: undefined } : layerConfig,
          metadata: {
            name: metadata.name,
            osmId: metadata.osmId,
            style: styleSerdeIndex,
          },
        };
      }),
    );
    if (outputType === "URL") {
      return (
        location.href.split("?")[0] +
        "?s=" +
        (await encodeJsonForUrl<ShareConfig>(layersExportData))
      );
    } else if (outputType === "JSON") {
      return JSON.stringify(layersExportData);
    } else {
      return "";
    }
  }
</script>

<div class="flex flex-col gap-2 px-1 pt-2">
  <div class="input overlay-name-field p-0">
    <div class="relative overflow-hidden">
      {#if outputType === "URL"}
        <Link class="pointer-events-none absolute top-1/2 left-2 z-10 size-4 -translate-y-1/2" />
      {:else if outputType === "JSON"}
        <Braces class="pointer-events-none absolute top-1/2 left-2 z-10 size-4 -translate-y-1/2" />
      {:else}
        <ClipboardType
          class="pointer-events-none absolute top-1/2 left-2 z-10 size-4 -translate-y-1/2"
        />
      {/if}

      <select
        class="select select-ghost tooltip tooltip-info tooltip-right w-10 border-0 px-7"
        aria-label="Choose output format."
        bind:value={outputType}
        data-tip="Select output format."
      >
        <option disabled>Select output format</option>
        {#each OutputTypes as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
    </div>
    <input type="text" class="input-lg grow" value={output} readonly />
    <button
      type="button"
      class="btn btn-square btn-ghost tooltip tooltip-info tooltip-left"
      disabled={output.length === 0}
      aria-label="Copy to clipboard."
      data-tip="Copy to clipboard."
      onclick={async () => {
        await navigator.clipboard.writeText(output);
      }}
    >
      <ClipboardCopy class="size-4" />
    </button>
  </div>
</div>
