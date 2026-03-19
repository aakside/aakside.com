<script module lang="ts">
  export interface NominatimResult {
    class: string;
    display_name: string;
    geojson?: Polygon | MultiPolygon;
    lat: string;
    lon: string;
    name: string;
    osm_id: number;
    osm_type: "node" | "relation" | "way";
    place_id: number;
    type: string;
  }

  interface ApiConfig {
    name: string;
    type: "Nominatim" | "Overpass";
    url: string;
  }

  // FIXME: I haven't actually been able to get geometry data from the overpass APIs.
  export const APIS: ApiConfig[] = [
    { name: "FOSSGIS e.V.", type: "Overpass", url: "https://overpass-api.de/api/interpreter" },
    { name: "OpenStreetMap", type: "Nominatim", url: "https://nominatim.openstreetmap.org" },
    {
      name: "Private.coffee",
      type: "Overpass",
      url: "https://overpass.private.coffee/api/interpreter",
    },
    {
      name: "VK Maps",
      type: "Overpass",
      url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    },
  ];

  export async function lookupRelationByOsmId(osmId: number): Promise<NominatimResult> {
    const endpoint = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${encodeURIComponent(String(osmId))}&format=json&polygon_geojson=1`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Lookup failed (${response.status})`);
    }

    const data = (await response.json()) as NominatimResult[];
    return data[0];
  }
</script>

<script lang="ts">
  import { type MultiPolygon, type Polygon } from "geojson";
  import { Eraser, Info, Locate, MapPlus, Search, Server } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import LayerInfoDialog from "./layer-info-dialog.svelte";
  import { LayerMetadata } from "./main.svelte";

  interface Props {
    onResultAddLayerClick: (result: NominatimResult) => void;
    onResultFlyClick: (result: NominatimResult) => void;
    osmTypes?: ("node" | "relation" | "way")[];
    placeholder?: string;
    selectedResult?: NominatimResult;
  }

  let {
    onResultAddLayerClick,
    onResultFlyClick,
    osmTypes = $bindable(["node", "relation", "way"]),
    placeholder = $bindable(undefined),
    selectedResult = $bindable(undefined),
  }: Props = $props();

  let selectedApi = $state(APIS.find((api) => api.name === "OpenStreetMap")!);
  let query = $state("");
  let results = $state<NominatimResult[]>([]);
  let isSearching = $state(false);
  let abortController = $state<AbortController | undefined>(undefined);
  let selectingResultPlaceId = $state<number | undefined>(undefined);
  let status = $state<
    { message?: string; type: "error" | "info" | "success" | "warning" } | undefined
  >(undefined);
  let shortOsmTypes = $derived(osmTypes.map((t) => t[0].toUpperCase()));

  async function hydrateSelectedResult(result: NominatimResult) {
    if (result.geojson) {
      return result;
    }

    const fullResult = await lookupRelationByOsmId(result.osm_id);
    return fullResult ?? result;
  }

  async function searchNominatim(query: string) {
    abortController?.abort();
    abortController = new AbortController();
    isSearching = true;
    status = { message: "Searching...", type: "info" };

    try {
      const osmIdPattern = /^\d+$/i;
      const isOsmIdSearch = osmIdPattern.test(query);
      let endpoint = isOsmIdSearch
        ? `https://nominatim.openstreetmap.org/lookup?osm_ids=${shortOsmTypes.map((t) => `${t}${encodeURIComponent(query)}`).join(",")}&format=json&polygon_geojson=1`
        : `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=${encodeURIComponent(query)}`;

      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      });

      if (!response.ok) {
        status = {
          message: `Search failed: ${response.statusText} (${await response.text()})`,
          type: "error",
        };
        throw new Error(`Search failed (${response.status})`);
      }

      const data = (await response.json()) as NominatimResult[];
      results = isOsmIdSearch ? data : data.filter((result) => osmTypes.includes(result.osm_type));
      status = {
        message: `${results.length} match${results.length === 1 ? "" : "es"} found.`,
        type: results.length === 0 ? "warning" : "info",
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      results = [];
      status = { message: "Could not load search results.", type: "error" };
    } finally {
      isSearching = false;
    }
  }

  function triggerSearch() {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      status = { message: "Query must be at least 2 characters long.", type: "error" };
    } else if (isSearching) {
      status = { message: "Search is already in progress.", type: "info" };
    } else {
      void searchNominatim(trimmedQuery);
    }
  }
</script>

<div class="input overlay-name-field p-0">
  <div class="relative overflow-hidden">
    <Server class="pointer-events-none absolute top-1/2 left-2 z-10 size-4 -translate-y-1/2" />
    <select
      class="select select-ghost tooltip tooltip-info tooltip-right w-10 border-0 px-7"
      aria-label="Search API provider"
      bind:value={selectedApi}
      data-tip="Select API provider."
    >
      <option disabled>Select an API provider</option>
      {#each APIS as api}
        <option disabled={api.type === "Overpass"} value={api}>{`${api.name} (${api.type})`}</option
        >
      {/each}
    </select>
  </div>
  <input
    type="text"
    class="input-lg grow"
    placeholder={placeholder ?? `Place name or OSM ${shortOsmTypes.join("/")} ID`}
    bind:value={query}
    onkeydown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        triggerSearch();
      }
    }}
  />
  <div class="join">
    {#if query.length > 0}
      <button
        type="button"
        class="btn join btn-square btn-ghost tooltip tooltip-info tooltip-left items-center"
        aria-label="Clear search"
        data-tip="Clear search"
        onclick={() => {
          query = "";
          results = [];
          status = undefined;
        }}
      >
        <Eraser class="size-4" />
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-square join btn-ghost tooltip tooltip-info tooltip-left items-center"
      disabled={isSearching || query.trim().length === 0}
      aria-label="Search"
      data-tip="Search"
      onclick={triggerSearch}
    >
      {#if isSearching}<span class="loading loading-spinner loading-xs"></span>{:else}<Search
          class="size-4"
        />{/if}
    </button>
  </div>
</div>
{#if status}
  <div
    class="text-sm"
    class:text-error={status.type === "error"}
    class:text-info={status.type === "info"}
    class:text-success={status.type === "success"}
    class:text-warning={status.type === "warning"}
  >
    {status.message}
  </div>
{/if}
{#if results.length > 0}
  <ul class="flex w-full flex-col gap-y-2 p-1" transition:slide={{ duration: 180 }}>
    {#each results as result (result.place_id)}
      <li class="m-0 p-0">
        <button
          class="btn h-auto min-h-0 w-full flex-col items-start justify-start py-2 text-left whitespace-normal transition-[border-radius] duration-200"
          class:border-base-content={selectedResult?.place_id === result.place_id}
          class:rounded-b-none={selectedResult?.place_id === result.place_id}
          class:border-b={selectedResult?.place_id === result.place_id}
          disabled={selectingResultPlaceId === result.place_id}
          type="button"
          onclick={() =>
            (selectedResult = selectedResult?.place_id === result.place_id ? undefined : result)}
        >
          <div class="w-full text-sm font-medium wrap-break-word whitespace-normal">
            {result.display_name}
          </div>
          <div class="text-xs opacity-70">
            {result.lat}, {result.lon}
          </div>
        </button>
        {#if selectedResult?.place_id === result.place_id}
          {@const metadata: LayerMetadata = {name: result.name, nominatimData: result}}
          <div
            class="[&>button]:border-base-content m-0 grid w-full auto-cols-fr grid-flow-col gap-0 overflow-visible rounded-t-none rounded-b-xl border-x border-b p-0 [&>button]:rounded-none [&>button]:border-0 [&>button]:border-r [&>button:first-of-type]:rounded-bl-xl [&>button:last-of-type]:rounded-br-xl [&>button:last-of-type]:border-r-0"
            transition:slide={{ duration: 180 }}
          >
            <button
              aria-label="Fly to location."
              class="btn btn-block tooltip tooltip-info"
              data-tip="Fly to location."
              onclick={() => {
                onResultFlyClick(result);
                selectedResult = undefined;
              }}><Locate /></button
            >
            {#if result.osm_type === "relation"}
              <button
                aria-label="Add layer to map."
                class="btn btn-block tooltip tooltip-info"
                data-tip="Add layer to map."
                onclick={async () => {
                  onResultAddLayerClick(await hydrateSelectedResult(result));
                  selectedResult = undefined;
                  results = [];
                  status = undefined;
                }}><MapPlus /></button
              >
            {/if}
            <button
              aria-label="View search result information."
              class="btn btn-block tooltip tooltip-info"
              data-tip="View search result information."
              onclick={(event) => {
                const trigger = event.currentTarget as HTMLElement | null;
                trigger?.parentElement
                  ?.querySelector<HTMLDialogElement>(
                    `:scope > dialog#result-${result.place_id}-info`,
                  )
                  ?.showModal();
              }}><Info /></button
            >
            <LayerInfoDialog id={`result-${result.place_id}`} {metadata} />
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
