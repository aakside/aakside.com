<script lang="ts">
  import { Map, MapState, type LayerConfigs } from "@aakside/svelte-maplibre-stack";
  import maplibregl from "maplibre-gl";
  import { onMount } from "svelte";
  import { zoom } from "../../../utils/mapping";

  interface MapConfigPresets {
    caption?: string;
    center: maplibregl.LngLat;
    desiredWidthMeters: number;
    layerConfigs: LayerConfigs;
    style?: string;
  }

  interface Props {
    mapConfigPresets: MapConfigPresets[];
  }

  let { mapConfigPresets }: Props = $props();

  let mapState = $state(
    new MapState(
      [
        {
          bearing: 0,
          center: {
            lat: 40.7886553,
            lng: -73.9603028,
          },
          zoom: 13,
        },
      ],
      0,
      0,
    ),
  );
  let currentHash = $state("");
  let presetIndex = $derived(parseInt(currentHash.replace("#manhattan-figure-", "")) || 0);
  let currentPresetId = $derived(`manhattan-figure-${presetIndex}`);

  onMount(() => {
    currentHash = window.location.hash;
    const handleHashChange = () => {
      currentHash = window.location.hash;
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  });

  $effect(() => {
    mapState.update(
      mapConfigPresets[presetIndex].layerConfigs.map((layerConfig, i) =>
        i === 0
          ? {
              ...layerConfig,
              zoom: zoom(
                mapConfigPresets[presetIndex].desiredWidthMeters,
                mapState.containerDimensions.x,
                mapConfigPresets[presetIndex].layerConfigs[0].center.lat,
              ),
            }
          : layerConfig,
      ),
    );
  });
</script>

<figure>
  <div class="carousel relative aspect-square w-full">
    <div class="carousel-item relative w-full" aria-label="Map views">
      <Map bind:mapState />
      <div
        class="absolute top-1/2 right-5 left-5 flex -translate-y-1/2 transform justify-between"
        id={currentPresetId}
      >
        <a
          class="btn btn-circle bg-neutral/50"
          href={`#manhattan-figure-${(presetIndex - 1 + mapConfigPresets.length) % mapConfigPresets.length}`}
          aria-label="Previous map view"
        >
          ❮
        </a>
        <a
          class="btn btn-circle bg-neutral/50"
          href={`#manhattan-figure-${(presetIndex + 1 + mapConfigPresets.length) % mapConfigPresets.length}`}
          aria-label="Next map view"
        >
          ❯
        </a>
      </div>
    </div>
  </div>
  <figcaption>{mapConfigPresets[presetIndex].caption ?? "Manhattan on the move."}</figcaption>
</figure>
