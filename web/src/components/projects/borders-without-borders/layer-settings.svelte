<script lang="ts">
  import { Blend, Lock, LockOpen, MapIcon, SquareDashedTopSolid } from "@lucide/svelte";
  import { MapLayer, MapState } from "@aakside/svelte-maplibre-stack";
  import { mapStyles } from "./main.svelte";

  export interface LayerSettings {
    style: string;
    opacity: number;
  }

  interface Props {
    isBaseMap?: boolean;
    layer: MapLayer;
    mapState: MapState;
  }

  let { isBaseMap = false, layer = $bindable(), mapState = $bindable() }: Props = $props();

  let isPitchLocked = $derived(
    mapState.minPitch !== undefined && mapState.minPitch === mapState.maxPitch,
  );
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
      aria-label="Layer opacity"
      type="range"
      min={0}
      max={1}
      step={0.01}
      bind:value={layer.opacity}
      class="range range-sm grow"
    />
  </div>
  {#if isBaseMap}
    <div class="flex w-full items-center gap-2">
      {#if isPitchLocked}
        <Lock class="size-4 shrink-0" />
      {:else}
        <LockOpen class="size-4 shrink-0" />
      {/if}
      <span class="grow text-sm">Lock pitch</span>
      <input
        aria-label="Lock pitch"
        bind:checked={
          () => isPitchLocked,
          (locked: boolean) => {
            if (locked) {
              const lockedPitch = layer.map?.getPitch() ?? mapState.pitch ?? 0;
              mapState.maxPitch = lockedPitch;
              mapState.minPitch = lockedPitch;
            } else {
              mapState.maxPitch = undefined;
              mapState.minPitch = undefined;
            }
          }
        }
        class="toggle toggle-sm"
        type="checkbox"
      />
    </div>
  {/if}
  {#if layer.clipPath}
    <div class="flex w-full items-center gap-2">
      <SquareDashedTopSolid class="size-4 shrink-0" />
      <span class="w-16 text-sm">Border</span>
      <input
        aria-label="Layer border width"
        class="range range-sm grow"
        defaultValue={0}
        max={15}
        min={0}
        step={0.5}
        type="range"
        bind:value={layer.pathBorderWidth}
      />
    </div>
  {/if}
</div>
