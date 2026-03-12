<script lang="ts">
  import { Blend, MapIcon, SquareDashedTopSolid } from "@lucide/svelte";
  import { MapLayer } from "@aakside/svelte-maplibre-stack";
  import { mapStyles } from "./main.svelte";

  export interface LayerSettings {
    style: string;
    opacity: number;
  }

  interface Props {
    layer: MapLayer;
  }

  let { layer = $bindable() }: Props = $props();
</script>

<div class="flex flex-col gap-2 px-1 pt-2">
  <div class="flex w-full items-center gap-2">
    <MapIcon class="size-4 shrink-0" />
    <span class="w-16 text-sm">Style</span>
    <select
      class="select select-bordered select-sm grow"
      aria-label="Map style"
      bind:value={layer.style}
    >
      {#each mapStyles as style}
        <option value={style.url}>{style.name}</option>
      {/each}
    </select>
  </div>
  <div class="flex w-full items-center gap-2">
    <Blend class="size-4 shrink-0" />
    <span class="w-16 text-sm">Opacity</span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      bind:value={layer.opacity}
      class="range range-sm grow"
    />
  </div>
  {#if layer.clipPath}
    <div class="flex w-full items-center gap-2">
      <SquareDashedTopSolid class="size-4 shrink-0" />
      <span class="w-16 text-sm">Border</span>
      <input
        type="range"
        defaultValue={0}
        min={0}
        max={15}
        step={0.5}
        bind:value={layer.pathBorderWidth}
        class="range range-sm grow"
      />
    </div>
  {/if}
</div>
