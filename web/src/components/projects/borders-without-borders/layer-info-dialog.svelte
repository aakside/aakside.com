<script lang="ts">
  import { X } from "@lucide/svelte";
  import { LayerMetadata } from "./main.svelte";

  let { id, metadata }: { id: string; metadata: LayerMetadata } = $props();
</script>

<dialog id="{id}-info" class="modal">
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-square tooltip tooltip-info absolute top-2 right-2"
        ><X /></button
      >
    </form>
    <h3 class="text-lg font-bold">{metadata.name}</h3>
    <table class="table">
      <tbody>
        <tr>
          <td>Name</td>
          <td>{metadata.nominatimData?.name}</td>
        </tr>
        <tr>
          <td>Display Name</td>
          <td>{metadata.nominatimData?.display_name}</td>
        </tr>
        <tr>
          <td>OSM Type</td>
          <td>{metadata.nominatimData?.osm_type}</td>
        </tr>
        <tr>
          <td>OSM ID</td>
          <td>{metadata.nominatimData?.osm_id}</td>
        </tr>
        <tr>
          <td>Latitude</td>
          <td>{metadata.nominatimData?.lat}</td>
        </tr>
        <tr>
          <td>Longitude</td>
          <td>{metadata.nominatimData?.lon}</td>
        </tr>
        <tr>
          <td>Class</td>
          <td>{metadata.nominatimData?.class}</td>
        </tr>
        <tr>
          <td>Type</td>
          <td>{metadata.nominatimData?.type}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>Close layer info modal</button>
  </form>
</dialog>

<style lang="postcss">
  @reference "tailwindcss";

  .modal-box button {
    @apply size-7;
  }

  .modal-box button :global(.lucide) {
    @apply size-5;
  }
</style>
