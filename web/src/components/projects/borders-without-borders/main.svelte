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
    serdeIndex: number;
    url?: string;
  }

  export const mapStyles: MapStyle[] = [
    {
      name: "Carto Dark Matter",
      serdeIndex: 1,
      url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    },
    {
      name: "Carto Positron",
      serdeIndex: 2,
      url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    },
    {
      name: "Carto Voyager",
      serdeIndex: 3,
      url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    },
    {
      name: "MapLibre Demo Tiles",
      serdeIndex: 4,
      url: "https://demotiles.maplibre.org/style.json",
    },
    {
      name: "OpenFreeMap Bright",
      serdeIndex: 5,
      url: "https://tiles.openfreemap.org/styles/bright",
    },
    { name: "OpenFreeMap Dark", serdeIndex: 6, url: "https://tiles.openfreemap.org/styles/dark" },
    { name: "OpenFreeMap Fiord", serdeIndex: 7, url: "https://tiles.openfreemap.org/styles/fiord" },
    {
      name: "OpenFreeMap Liberty",
      serdeIndex: 8,
      url: "https://tiles.openfreemap.org/styles/liberty",
    },
    {
      name: "OpenFreeMap Positron",
      serdeIndex: 9,
      url: "https://tiles.openfreemap.org/styles/positron",
    },
    { name: "OpenStreetMap Americana", serdeIndex: 10, url: "https://americanamap.org/style.json" },
    {
      name: "VersaTiles Colorful",
      serdeIndex: 11,
      url: "https://vector.openstreetmap.org/styles/shortbread/colorful.json",
    },
    {
      name: "VersaTiles Eclipse",
      serdeIndex: 12,
      url: "https://vector.openstreetmap.org/styles/shortbread/eclipse.json",
    },
    {
      name: "VersaTiles Graybeard",
      serdeIndex: 13,
      url: "https://vector.openstreetmap.org/styles/shortbread/graybeard.json",
    },
    {
      name: "VersaTiles Neutrino",
      serdeIndex: 14,
      url: "https://vector.openstreetmap.org/styles/shortbread/neutrino.json",
    },
    {
      name: "VersaTiles Shadow",
      serdeIndex: 15,
      url: "https://vector.openstreetmap.org/styles/shortbread/shadow.json",
    },
    { name: "Unset", serdeIndex: 0, url: undefined },
  ];
</script>

<script lang="ts">
  import {
    Map,
    MapLayer,
    MapState,
    type LayerConfigs,
    type OverlayLayer,
  } from "@aakside/svelte-maplibre-stack";
  import { URLShieldRenderer } from "@americana/maplibre-shield-generator";
  import { bounds, BoundsFrom, controls, ControlFrom, disabled, draggable } from "@neodrag/svelte";
  import {
    Eye,
    EyeOff,
    Import,
    Info,
    ListChevronsDownUp,
    ListChevronsUpDown,
    Locate,
    LocateFixed,
    MapPinned,
    Pencil,
    Share2,
    SlidersHorizontal,
    Trash,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { slide } from "svelte/transition";
  import InfoDialog from "./info-dialog.svelte";
  import LayerInfoDialog from "./layer-info-dialog.svelte";
  import LayerSettings from "./layer-settings.svelte";
  import Share, { type ShareConfig } from "./share.svelte";
  import ImportConfig from "./import-config.svelte";
  import PlaceSearch, { lookupRelationByOsmId } from "./search.svelte";
  import { decodeJsonFromUrl } from "../../../utils/url-codec";
  import { installAmericanaRuntimeAssets } from "./americana";

  const americanaShieldRenderers = new WeakMap<maplibregl.Map, URLShieldRenderer>();

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
        visible: true,
        zoom: 13,
      },
    ]),
  );
  // svelte-ignore state_referenced_locally
  layersMetadata.set(mapState.layers[0].id, new LayerMetadata("Base Map"));

  async function importConfig(config: ShareConfig) {
    const configWithGeojson = await Promise.all(
      config.map(async (layer, i) => {
        const style =
          mapStyles.find((style) => style.serdeIndex === layer.metadata.style)?.url ??
          layer.config.style;
        if (layer.metadata.osmId && !layer.config.geojson) {
          if (layer.metadata.nominatimData?.geojson) {
            layer.config.geojson = layer.metadata.nominatimData.geojson;
            return {
              config: {
                ...layer.config,
                geojson: layer.metadata.nominatimData.geojson,
                style,
              },
              metadata: layer.metadata,
            };
          }
          const nominatimData = await lookupRelationByOsmId(layer.metadata.osmId!);
          return {
            config: {
              ...layer.config,
              geojson: nominatimData.geojson,
              style,
            },
            metadata: {
              ...layer.metadata,
              nominatimData,
            },
          };
        }
        return { ...layer, config: { ...layer.config, style } };
      }),
    );
    mapState.update(configWithGeojson.map((layer) => layer.config) as LayerConfigs);
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
  let expanded = new SvelteMap<string, string>([["root", "toolbar"]]);
  let importedConfigJson = $state<string | undefined>(undefined);

  $effect(() => {
    mapState.layers.forEach((layer) => {
      if (layer.map && !americanaShieldRenderers.has(layer.map)) {
        americanaShieldRenderers.set(layer.map, installAmericanaRuntimeAssets(layer.map));
      }
    });
  });

  function toggleCollapsed(parent: string, key: string) {
    expanded.get(parent) === key ? expanded.delete(parent) : expanded.set(parent, key);
  }

  function openDialogInParent(event: Event, selector: string) {
    const trigger = event.currentTarget as HTMLElement | null;
    trigger?.parentElement?.querySelector<HTMLDialogElement>(selector)?.showModal();
  }

  function moveLayerToCurrentView(index: number) {
    mapState.layers[index].baseMapPosition.lat = mapState.center.lat;
    mapState.layers[index].baseMapPosition.lng = mapState.center.lng;
  }

  function isLocal() {
    const hostname = window.location.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  }

  function isAccessibleStyle(style: MapStyle) {
    return style.url && (!style.url.startsWith("https://vector.openstreetmap.org") || isLocal());
  }
</script>

<div class="h-screen w-screen" data-theme="winter" bind:clientWidth={width}>
  <div
    class={`bg-base-100 relative top-0 left-0 z-1 text-base shadow-md max-md:w-full md:absolute md:top-4 md:left-4 md:rounded-lg md:transition-[width] md:duration-200 md:ease-out ${expanded.get("root") === "toolbar" ? "md:w-[24rem]" : "md:w-[18rem]"}`}
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
      class:md:rounded-lg={expanded.get("root") !== "toolbar"}
      class:md:rounded-t-lg={expanded.get("root") === "toolbar"}
    >
      <button
        aria-pressed={expanded.get("root") === "toolbar"}
        class="btn btn-square tooltip tooltip-info tooltip-right"
        data-tip={expanded.get("root") === "toolbar" ? "Hide toolbar." : "Show toolbar."}
        onclick={() => toggleCollapsed("root", "toolbar")}
      >
        {#if expanded.get("root") === "toolbar"}
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
    {#if expanded.get("root") === "toolbar"}
      <div class="flex flex-col gap-2 px-3 py-2" transition:slide={{ duration: 220 }}>
        <PlaceSearch
          onResultAddLayerClick={(result) => {
            const layerId = mapState.addLayer({
              baseMapPosition: $state.snapshot(mapState.center),
              bearing: 0,
              center: {
                lat: Number(result!.lat),
                lng: Number(result!.lon),
              },
              overlayCenter: {
                lat: Number(result!.lat),
                lng: Number(result!.lon),
              },
              geojson: result?.geojson as OverlayLayer["geojson"],
              visible: true,
            });
            layersMetadata.set(layerId, new LayerMetadata(result!.name, result!.osm_id, result));
          }}
          onResultFlyClick={(result) => {
            mapState.layers[0].map?.flyTo({
              center: {
                lat: Number(result.lat),
                lng: Number(result.lon),
              },
            });
          }}
          osmTypes={["node", "relation"]}
        />
        <div class="layers-header">
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
            class:border-base-content={expanded.get("toolbar") === "import-config"}
            data-tip={expanded.get("toolbar") === "import-config"
              ? "Hide import configuration panel."
              : "Import map configuration."}
            onclick={() => toggleCollapsed("toolbar", "import-config")}><Import /></button
          >
          <button
            aria-label="Share map configuration."
            class="btn btn-square tooltip tooltip-info"
            class:border-base-content={expanded.get("toolbar") === "share-config"}
            data-tip={expanded.get("toolbar") === "share-config"
              ? "Hide share configuration panel."
              : "Copy share link to clipboard."}
            onclick={() => toggleCollapsed("toolbar", "share-config")}><Share2 /></button
          >
        </div>
        {#if expanded.get("toolbar") === "import-config"}
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
        {#if expanded.get("toolbar") === "share-config"}
          <Share {mapState} {layersMetadata} />
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
                    class:border-base-content={expanded.get(layer.id) === "settings"}
                    data-tip={expanded.get(layer.id) === "settings"
                      ? "Hide extra settings."
                      : "Adjust more settings."}
                    onclick={() => toggleCollapsed(layer.id, "settings")}
                    ><SlidersHorizontal /></button
                  >
                </div>
                {#if expanded.get(layer.id) === "settings"}
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
