<script module lang="ts">
  export class LayerMetadata {
    name: string;
    osmId?: number;
    nominatimData?: any;

    constructor(name: string, osmId?: number, nominatimData?: any) {
      this.name = $state(name);
      this.osmId = osmId;
      this.nominatimData = nominatimData;
    }
  }

  export interface MapStyle {
    name: string;
    url?: string;
  }

  export const mapStyles: MapStyle[] = [
    {
      name: "Carto Dark Matter",
      url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    },
    {
      name: "Carto Positron",
      url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    },
    {
      name: "Carto Voyager",
      url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    },
    { name: "MapLibre Demo Tiles", url: "https://demotiles.maplibre.org/style.json" },
    { name: "OpenFreeMap Bright", url: "https://tiles.openfreemap.org/styles/bright" },
    { name: "OpenFreeMap Dark", url: "https://tiles.openfreemap.org/styles/dark" },
    { name: "OpenFreeMap Fiord", url: "https://tiles.openfreemap.org/styles/fiord" },
    { name: "OpenFreeMap Liberty", url: "https://tiles.openfreemap.org/styles/liberty" },
    { name: "OpenFreeMap Positron", url: "https://tiles.openfreemap.org/styles/positron" },
    { name: "OpenStreetMap Americana", url: "https://americanamap.org/style.json" }, // FIXME: requires spritesheet https://github.com/osm-americana/openstreetmap-americana?tab=readme-ov-file#artifacts
    {
      name: "VersaTiles Colorful",
      url: "https://vector.openstreetmap.org/styles/shortbread/colorful.json",
    },
    {
      name: "VersaTiles Eclipse",
      url: "https://vector.openstreetmap.org/styles/shortbread/eclipse.json",
    },
    {
      name: "VersaTiles Graybeard",
      url: "https://vector.openstreetmap.org/styles/shortbread/graybeard.json",
    },
    {
      name: "VersaTiles Neutrino",
      url: "https://vector.openstreetmap.org/styles/shortbread/neutrino.json",
    },
    {
      name: "VersaTiles Shadow",
      url: "https://vector.openstreetmap.org/styles/shortbread/shadow.json",
    },
    { name: "Unset", url: undefined },
  ];
</script>

<script lang="ts">
  import { Map, MapLayer, MapState } from "@aakside/svelte-maplibre-stack";
  import { bounds, BoundsFrom, controls, ControlFrom, disabled, draggable } from "@neodrag/svelte";
  import PlaceSearch, { lookupRelationByOsmId, type NominatimResult } from "./search.svelte";
  import {
    Eye,
    EyeOff,
    Import,
    Info,
    ListChevronsDownUp,
    ListChevronsUpDown,
    Locate,
    LocateFixed,
    Map as MapIcon,
    MapPinned,
    MapPlus,
    Move,
    Pencil,
    Settings,
    Share2,
    SlidersHorizontal,
    Trash,
  } from "@lucide/svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import InfoDialog from "./info-dialog.svelte";
  import LayerInfoDialog from "./layer-info-dialog.svelte";
  import LayerSettings from "./layer-settings.svelte";
  import Share, { type ShareConfig } from "./share.svelte";
  import ImportConfig from "./import-config.svelte";
  import { decodeJsonFromUrl } from "../../../utils/url-codec";
  import { onMount } from "svelte";

  const searchParams = new URLSearchParams(window.location.search);

  let layersMetadata = new SvelteMap<MapLayer["id"], LayerMetadata>();

  let mapState = $state(
    new MapState([
      {
        bearing: 0,
        center: {
          lat: 40.76670493441853,
          lng: -74.00622380728765,
        },
        zoom: 13,
      },
    ]),
  );
  layersMetadata.set(mapState.layers[0].id, new LayerMetadata("Base Map"));

  async function importConfig(config: ShareConfig) {
    const configWithGeojson = await Promise.all(
      config.map(async (layer, i) => {
        if (layer.metadata.osmId && !layer.config.geojson) {
          if (layer.metadata.nominatimData?.geojson) {
            layer.config.geojson = layer.metadata.nominatimData.geojson;
            return {
              config: {
                ...layer.config,
                geojson: layer.metadata.nominatimData.geojson,
              },
              metadata: layer.metadata,
            };
          }
          const nominatimData = await lookupRelationByOsmId(layer.metadata.osmId!);
          return {
            config: {
              ...layer.config,
              geojson: nominatimData.geojson,
            },
            metadata: {
              ...layer.metadata,
              nominatimData,
            },
          };
        }
        return layer;
      }),
    );
    mapState.update(configWithGeojson.map((layer) => layer.config));
    configWithGeojson.forEach((layer, i) => {
      layersMetadata.set(
        mapState.layers[i].id,
        new LayerMetadata(layer.metadata.name, layer.metadata.osmId, layer.metadata.nominatimData),
      );
    });
  }

  onMount(async () => {
    if (searchParams.has("s")) {
      await importConfig(await decodeJsonFromUrl<ShareConfig>(searchParams.get("s")!));
    }
  });

  let width = $state<number>();
  let isSmallWidth = $derived(width !== undefined && width < 768);
  let expanded = new SvelteSet<string>(["toolbar"]);
  let addLayerSelectedResult = $state<NominatimResult | undefined>(undefined);
  let importedConfigJson = $state<string | undefined>(undefined);

  function toggleCollapsed(key: string) {
    expanded.has(key) ? expanded.delete(key) : expanded.add(key);
  }

  function openDialogInParent(event: Event, selector: string) {
    const trigger = event.currentTarget as HTMLElement | null;
    trigger?.parentElement?.querySelector<HTMLDialogElement>(selector)?.showModal();
  }

  function moveLayerToCurrentView(index: number) {
    mapState.layers[index].baseMapPosition.lat = mapState.center.lat;
    mapState.layers[index].baseMapPosition.lng = mapState.center.lng;
  }
</script>

<div class="h-screen w-screen" data-theme="winter" bind:clientWidth={width}>
  <div
    class="bg-base-100 relative top-0 left-0 z-1 text-base shadow-md max-md:w-full md:absolute md:top-4 md:left-4 md:max-w-sm md:rounded-lg"
    {@attach draggable(() => [
      bounds(BoundsFrom.viewport()),
      controls({
        allow: ControlFrom.selector(".toolbar-header"),
        block: ControlFrom.selector("button"),
      }),
      ...(isSmallWidth ? [disabled(true)] : []),
    ])}
  >
    <div
      class="toolbar-header bg-base-300 md:active:cursor-grabbing"
      class:md:rounded-lg={!expanded.has("toolbar")}
      class:md:rounded-t-lg={expanded.has("toolbar")}
    >
      <button
        aria-pressed={expanded.has("toolbar")}
        class="btn btn-square tooltip tooltip-info tooltip-right"
        data-tip={expanded.has("toolbar") ? "Hide toolbar." : "Show toolbar."}
        onclick={() => toggleCollapsed("toolbar")}
      >
        {#if expanded.has("toolbar")}
          <ListChevronsDownUp />
        {:else}
          <ListChevronsUpDown />
        {/if}</button
      >
      <button
        class="btn btn-square tooltip tooltip-info tooltip-right size-6"
        data-tip="Learn more about this app."
        onclick={(event) => openDialogInParent(event, ":scope > dialog#app-info")}
        ><Info class="size-6" /></button
      >
      <InfoDialog />
      <div class="grow text-lg font-bold">Borders Without Borders</div>
    </div>
    {#if expanded.has("toolbar")}
      <div class="flex flex-col gap-2 px-3 py-2">
        <PlaceSearch
          onResultClick={(result) => {
            mapState.layers[0].map?.flyTo({
              center: {
                lat: Number(result.lat),
                lng: Number(result.lon),
              },
            });
          }}
          osmTypes={["node", "relation"]}
          placeholder="Fly to a place"
        />
        <div class="layers-header">
          <button
            aria-label="Add Map Layer."
            class="btn btn-square tooltip tooltip-info tooltip-right"
            class:btn-outline={expanded.has("add-layer")}
            data-tip={expanded.has("add-layer")
              ? "Hide add layer panel."
              : "Add a new overlay layer."}
            onclick={() => toggleCollapsed("add-layer")}><MapPlus /></button
          >
          <button
            aria-label="Show your location on the map."
            class="btn btn-square tooltip tooltip-info tooltip-right"
            data-tip="Show your location."
            onclick={() => {
              navigator.geolocation.getCurrentPosition((position) => {
                mapState.layers[0].map?.flyTo({
                  center: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  },
                  zoom: 14,
                });
              });
            }}><LocateFixed /></button
          >
          <button
            aria-label="Import map configuration."
            class="btn btn-square tooltip tooltip-info"
            class:btn-outline={expanded.has("import-config")}
            data-tip={expanded.has("import-config")
              ? "Hide import configuration panel."
              : "Import map configuration."}
            onclick={() => toggleCollapsed("import-config")}><Import /></button
          >
          <button
            aria-label="Share map configuration."
            class="btn btn-square tooltip tooltip-info"
            class:btn-outline={expanded.has("share-config")}
            data-tip={expanded.has("share-config")
              ? "Hide share configuration panel."
              : "Copy share link to clipboard."}
            onclick={() => toggleCollapsed("share-config")}><Share2 /></button
          >
          <button
            aria-label="Global settings."
            class="btn btn-square tooltip tooltip-info"
            class:btn-outline={expanded.has("global-settings")}
            data-tip={expanded.has("global-settings")
              ? "Hide global settings panel."
              : "Adjust global settings."}
            onclick={() => toggleCollapsed("global-settings")}><Settings /></button
          >
        </div>
        {#if expanded.has("add-layer")}
          <div class="flex flex-col gap-2 px-1 pt-2">
            <PlaceSearch bind:selectedResult={addLayerSelectedResult} osmTypes={["relation"]} />
            <div class="flex w-full items-center gap-2">
              {#if addLayerSelectedResult}
                <button
                  class="btn"
                  disabled={!addLayerSelectedResult?.geojson}
                  onclick={() => {
                    const layerId = mapState.addLayer({
                      baseMapPosition: $state.snapshot(mapState.center),
                      bearing: 0,
                      center: {
                        lat: Number(addLayerSelectedResult!.lat),
                        lng: Number(addLayerSelectedResult!.lon),
                      },
                      geojson: addLayerSelectedResult?.geojson,
                    });
                    layersMetadata.set(
                      layerId,
                      new LayerMetadata(
                        addLayerSelectedResult!.name,
                        addLayerSelectedResult!.osm_id,
                        addLayerSelectedResult,
                      ),
                    );
                    addLayerSelectedResult = undefined;
                    expanded.delete("add-layer");
                  }}>Add Layer</button
                >
              {/if}
            </div>
          </div>
        {/if}
        {#if expanded.has("import-config")}
          <div class="flex flex-col gap-2 px-1 pt-2">
            <ImportConfig bind:configJson={importedConfigJson} />
            <div class="flex w-full items-center gap-2">
              <button
                class="btn"
                disabled={!importedConfigJson || importedConfigJson.length === 0}
                onclick={() => {
                  importConfig(JSON.parse(importedConfigJson!));
                }}>Import Configuration</button
              >
            </div>
          </div>
        {/if}
        {#if expanded.has("share-config")}
          <Share {mapState} {layersMetadata} />
        {/if}
        {#if expanded.has("global-settings")}
          <div class="flex flex-col gap-2 px-1 pt-2">
            <div class="flex w-full items-center gap-2">
              <MapIcon class="size-4 shrink-0" />
              <span class="w-16 text-sm">Style</span>
              <select
                class="select select-bordered select-sm grow"
                aria-label="Map style"
                bind:value={mapState.style}
              >
                {#each mapStyles as style}
                  {#if style.url !== undefined}<option value={style.url}>{style.name}</option>{/if}
                {/each}
              </select>
            </div>
          </div>
        {/if}
        <div class="map-layers flex flex-col gap-y-2" class:mt-2={mapState.layers.length > 1}>
          {#if mapState.layers.length > 1}<hr />
          {/if}
          {#each mapState.layers.toReversed() as layer, reverseIndex (layer.id)}
            {@const index = mapState.layers.length - 1 - reverseIndex}
            {@const layerMetadata = layersMetadata.get(layer.id)!}
            <div class="map-layer flex">
              <details class="collapse-arrow collapse">
                <summary class="collapse-title p-0 text-lg">
                  <div class="input input-ghost overlay-name-field border-0 p-0">
                    <button
                      aria-label="Edit layer name."
                      class="btn btn-square edit-name-button tooltip tooltip-info tooltip-right"
                      data-tip="Edit layer name."
                      onclick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const row = (event.currentTarget as HTMLElement).closest(
                          ".overlay-name-field",
                        );
                        const input = row?.querySelector(
                          "input[type='text']",
                        ) as HTMLInputElement | null;
                        if (input) {
                          input.readOnly = false;
                          input.classList.remove("pointer-events-none");
                          input.focus();
                          input.select();
                        }
                      }}
                    >
                      <Pencil />
                    </button>
                    <input
                      type="text"
                      class="input-lg pointer-events-none grow"
                      placeholder="Overlay Name"
                      bind:value={layerMetadata.name}
                      readonly
                      onblur={(event) => {
                        const input = event.currentTarget as HTMLInputElement;
                        input.readOnly = true;
                        input.classList.add("pointer-events-none");
                      }}
                      onkeydown={(event) => {
                        if (event.key === "Enter" || event.key === "Escape") {
                          (event.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </div>
                </summary>
                <div class="collapse-content button-set text-sm">
                  {#if index !== 0}
                    <button
                      aria-label="Move layer to new location."
                      class="btn btn-square tooltip tooltip-info tooltip-right"
                      data-tip="Move layer to a new position."
                    >
                      <Move />
                    </button>
                    <button
                      aria-label="Move layer to current location."
                      class="btn btn-square tooltip tooltip-info tooltip-right"
                      data-tip="Move layer to center of current view."
                      onclick={() => moveLayerToCurrentView(index)}><MapPinned /></button
                    >
                    <button
                      aria-label="Fly to layer location."
                      class="btn btn-square tooltip tooltip-info"
                      data-tip="Fly to where the layer is."
                      onclick={() => mapState.flyToLayer(index)}><Locate /></button
                    >
                    <button
                      aria-label="Delete layer."
                      class="btn btn-square tooltip tooltip-info"
                      data-tip="Delete layer."
                      onclick={() => layersMetadata.delete(mapState.removeLayer(index))}
                      ><Trash /></button
                    >
                    <button
                      aria-label="View layer information."
                      class="btn btn-square tooltip tooltip-info"
                      data-tip="View layer information."
                      onclick={(event) =>
                        openDialogInParent(event, `:scope > dialog#${layer.id}-info`)}
                      ><Info /></button
                    >
                    <LayerInfoDialog id={layer.id} metadata={layerMetadata} />
                  {/if}
                  <button
                    aria-label="Toggle layer visibility."
                    class="btn btn-square tooltip tooltip-info"
                    data-tip={(mapState.layers[index].visible ?? true)
                      ? "Hide layer."
                      : "Unhide layer."}
                    onclick={() => mapState.layers[index].toggleVisibility()}
                    >{#if mapState.layers[index].visible ?? true}<EyeOff />{:else}<Eye
                      />{/if}</button
                  >
                  <button
                    aria-label="More settings."
                    class="btn btn-square tooltip tooltip-info"
                    class:btn-outline={expanded.has(`${layer.id}-settings`)}
                    data-tip={expanded.has(`${layer.id}-settings`)
                      ? "Hide extra settings."
                      : "Adjust more settings."}
                    onclick={() => toggleCollapsed(`${layer.id}-settings`)}
                    ><SlidersHorizontal /></button
                  >
                </div>
                {#if expanded.has(`${layer.id}-settings`)}
                  <LayerSettings bind:layer={mapState.layers[index]} />
                {/if}
              </details>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  <Map bind:mapState />
</div>

<style lang="postcss">
  @reference "tailwindcss";

  @plugin "daisyui/theme" {
    name: "winter";
    default: false;
    prefersdark: true;
    color-scheme: "light";
    --color-base-100: oklch(100% 0 0);
    --color-base-200: oklch(97.466% 0.011 259.822);
    --color-base-300: oklch(93.268% 0.016 262.751);
    --color-base-content: oklch(41.886% 0.053 255.824);
    --color-primary: oklch(56.86% 0.255 257.57);
    --color-primary-content: oklch(91.372% 0.051 257.57);
    --color-secondary: oklch(42.551% 0.161 282.339);
    --color-secondary-content: oklch(88.51% 0.032 282.339);
    --color-accent: oklch(59.939% 0.191 335.171);
    --color-accent-content: oklch(11.988% 0.038 335.171);
    --color-neutral: oklch(19.616% 0.063 257.651);
    --color-neutral-content: oklch(83.923% 0.012 257.651);
    --color-info: oklch(88.127% 0.085 214.515);
    --color-info-content: oklch(17.625% 0.017 214.515);
    --color-success: oklch(80.494% 0.077 197.823);
    --color-success-content: oklch(16.098% 0.015 197.823);
    --color-warning: oklch(89.172% 0.045 71.47);
    --color-warning-content: oklch(17.834% 0.009 71.47);
    --color-error: oklch(73.092% 0.11 20.076);
    --color-error-content: oklch(14.618% 0.022 20.076);
    --radius-selector: 1rem;
    --radius-field: 0.5rem;
    --radius-box: 1rem;
    --size-selector: 0.25rem;
    --size-field: 0.25rem;
    --border: 1px;
    --depth: 0;
    --noise: 0;
  }

  .toolbar-header {
    @apply flex w-full flex-row items-center gap-x-2 px-3 py-2 align-baseline md:cursor-grab md:select-none;
  }

  .toolbar-header > button {
    @apply size-8;
  }

  .toolbar-header > button :global(.lucide) {
    @apply size-6;
  }

  .layers-header {
    @apply flex flex-row items-center gap-x-2;
  }

  .layers-header > button {
    @apply size-9;
  }

  .layers-header > button :global(.lucide) {
    @apply size-7;
  }

  .map-layers .map-layer .button-set {
    @apply flex flex-row items-center gap-1 rounded-md py-1 pl-1;
  }

  .map-layers .map-layer .button-set > button {
    @apply size-8;
  }
  .map-layers .map-layer .button-set > button :global(.lucide) {
    @apply size-6;
  }

  .edit-name-button {
    @apply size-7 flex-none;
  }

  .edit-name-button :global(.lucide) {
    @apply size-4;
  }

  .overlay-name-field {
    cursor: pointer;
  }

  .overlay-name-field input:read-only {
    cursor: pointer !important;
  }

  .overlay-name-field input:read-write {
    cursor: text !important;
  }

  .map-layers .map-layer .collapse,
  .map-layers .map-layer .collapse-content {
    overflow: visible;
  }
</style>
