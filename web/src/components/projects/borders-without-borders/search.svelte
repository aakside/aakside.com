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
  import { Search, Server } from "@lucide/svelte";

  interface Props {
    onResultClick?: (result: NominatimResult) => void;
    osmTypes?: ("node" | "relation" | "way")[];
    placeholder?: string;
    selectedResult?: NominatimResult;
  }

  let {
    onResultClick,
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

  async function selectAddLayerResult(result: NominatimResult) {
    query = result.display_name;
    selectingResultPlaceId = result.place_id;
    status = undefined;

    try {
      selectedResult = await hydrateSelectedResult(result);
    } catch {
      status = { message: "Could not load full relation geometry for this result.", type: "error" };
      selectedResult = result;
    } finally {
      selectingResultPlaceId = undefined;
    }
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
  <button
    type="button"
    class="btn btn-square btn-ghost tooltip tooltip-info tooltip-left"
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
{#if query.trim().length > 0 && results.length > 0}
  <ul class="menu rounded-box w-full flex-col gap-2 p-1">
    {#each results as result (result.place_id)}
      <li>
        <button
          class="btn text-left"
          class:btn-outline={selectedResult?.osm_id === result.osm_id}
          disabled={selectingResultPlaceId === result.place_id}
          type="button"
          onclick={() => {
            if (onResultClick) {
              onResultClick(result);
              query = "";
              status = undefined;
            } else {
              void selectAddLayerResult(result);
            }
          }}
        >
          <div class="text-sm font-medium">{result.display_name}</div>
          <div class="text-xs opacity-70">
            {result.lat}, {result.lon}
          </div>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style lang="postcss">
</style>
