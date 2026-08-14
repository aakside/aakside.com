<script lang="ts">
  import {
    Angle,
    Blend,
    Compass,
    Lock,
    LockOpen,
    MapIcon,
    SquareDashedTopSolid,
  } from "@lucide/svelte";
  import { MapLayer, MapState } from "@aakside/svelte-maplibre-stack";
  import { mapStyles } from "./main.svelte";

  export interface LayerSettings {
    style: string;
    opacity: number;
  }

  interface Props {
    index: number;
    layer: MapLayer;
    mapState: MapState;
  }

  let { index = $bindable(), layer = $bindable(), mapState = $bindable() }: Props = $props();
  const isBaseMap = $derived(index === 0);

  let isPitchLocked = $derived(
    mapState.minPitch !== undefined && mapState.minPitch === mapState.maxPitch,
  );
  let editingValue: "pitch" | "bearing" | "zoom" | "border" | null = $state(null);
</script>

<div class="flex flex-col gap-1 px-1">
  <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
    <div class="text-base-content/80 flex items-center gap-1.5">
      <MapIcon class="size-3.5 shrink-0" />
      <span class="text-xs font-medium tracking-wide uppercase">Style</span>
    </div>
    <select
      class="select select-bordered select-xs grow"
      aria-label="Map style"
      bind:value={layer.style}
    >
      {#each mapStyles as style}
        <option value={style.url}>{style.name}</option>
      {/each}
    </select>
  </div>
  <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
    <div class="text-base-content/80 flex items-center gap-1.5">
      <Blend class="size-3.5 shrink-0" />
      <span class="text-xs font-medium tracking-wide uppercase">Opacity</span>
    </div>
    <input
      aria-label="Layer opacity"
      type="range"
      min={0}
      max={1}
      step={0.01}
      bind:value={layer.opacity}
      class="range range-sm range-primary grow"
    />
    {#if editingValue === "opacity"}
      <input
        aria-label="Opacity value"
        class="input input-ghost input-xs h-6 min-h-0 w-16 rounded px-1 text-right text-xs font-semibold tabular-nums"
        type="number"
        bind:value={() => layer.opacity * 100, (value) => (layer.opacity = value / 100)}
        max={100}
        min={0}
        step={1}
        onblur={() => {
          editingValue = null;
        }}
        autofocus
      />
    {:else}
      <button
        type="button"
        class="btn btn-ghost btn-xs h-6 min-h-0 min-w-12 rounded px-1 text-right text-xs font-semibold tabular-nums"
        onclick={() => {
          editingValue = "opacity";
        }}
      >
        {(Number(layer.opacity ?? 0) * 100).toFixed(0)}%
      </button>
    {/if}
  </div>

  <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
    <div class="text-base-content/80 flex items-center gap-1.5">
      <Compass class="size-3.5 shrink-0" />
      <span class="text-xs font-medium tracking-wide uppercase">Bearing</span>
    </div>
    <input
      aria-label="Bearing"
      bind:value={() => layer.bearing, (bearing) => mapState.setBearing(index, bearing)}
      class="range range-sm range-primary grow"
      disabled={layer.isBearingLocked}
      max={180}
      min={-180}
      step={1}
      type="range"
    />
    {#if editingValue === "bearing"}
      <input
        aria-label="Bearing value"
        class="input input-ghost input-xs h-6 min-h-0 w-14 rounded px-1 text-right text-xs font-semibold tabular-nums"
        type="number"
        bind:value={layer.bearing}
        max={180}
        min={-180}
        step={1}
        onblur={() => {
          editingValue = null;
        }}
        autofocus
      />
    {:else}
      <button
        type="button"
        class="btn btn-ghost btn-xs h-6 min-h-0 min-w-12 rounded px-1 text-right text-xs font-semibold tabular-nums"
        onclick={() => {
          editingValue = "bearing";
        }}
      >
        {Math.round(layer.bearing ?? 0)}°
      </button>
    {/if}
    <label
      class="swap btn btn-xs btn-ghost shrink-0 px-1"
      aria-label={layer.isBearingLocked ? "Unlock bearing" : "Lock bearing"}
    >
      <input type="checkbox" bind:checked={layer.isBearingLocked} />
      <Lock class="swap-on size-3.5" />
      <LockOpen class="swap-off size-3.5" />
    </label>
  </div>
  {#if isBaseMap}
    <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
      <div class="text-base-content/80 flex items-center gap-1.5">
        <Angle class="size-3.5 shrink-0" />
        <span class="text-xs font-medium tracking-wide uppercase">Pitch</span>
      </div>
      <input
        aria-label="Pitch"
        bind:value={mapState.pitch}
        class="range range-sm range-primary grow"
        disabled={isPitchLocked}
        max={60}
        min={0}
        step={1}
        type="range"
      />
      {#if editingValue === "pitch"}
        <input
          aria-label="Pitch value"
          class="input input-ghost input-xs h-6 min-h-0 w-14 rounded px-1 text-right text-xs font-semibold tabular-nums"
          type="number"
          bind:value={mapState.pitch}
          max={60}
          min={0}
          step={1}
          onblur={() => {
            editingValue = null;
          }}
          autofocus
        />
      {:else}
        <button
          type="button"
          class="btn btn-ghost btn-xs h-6 min-h-0 min-w-12 rounded px-1 text-right text-xs font-semibold tabular-nums"
          onclick={() => {
            editingValue = "pitch";
          }}
        >
          {Math.round(mapState.pitch ?? 0)}°
        </button>
      {/if}
      <label
        class="swap btn btn-xs btn-ghost shrink-0 px-1"
        aria-label={isPitchLocked ? "Unlock pitch" : "Lock pitch"}
      >
        <input
          type="checkbox"
          bind:checked={
            () => isPitchLocked,
            () => {
              if (isPitchLocked) {
                mapState.maxPitch = undefined;
                mapState.minPitch = undefined;
              } else {
                const lockedPitch = layer.map?.getPitch() ?? mapState.pitch ?? 0;
                mapState.maxPitch = lockedPitch;
                mapState.minPitch = lockedPitch;
              }
            }
          }
        />
        <Lock class="swap-on size-3.5" />
        <LockOpen class="swap-off size-3.5" />
      </label>
    </div>

    <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
      <div class="text-base-content/80 flex items-center gap-1.5">
        <MapIcon class="size-3.5 shrink-0" />
        <span class="text-xs font-medium tracking-wide uppercase">Zoom</span>
      </div>
      <input
        aria-label="Zoom"
        bind:value={mapState.zoom}
        class="range range-sm range-primary grow"
        max={22}
        min={0}
        step={0.1}
        type="range"
      />
      {#if editingValue === "zoom"}
        <input
          aria-label="Zoom value"
          class="input input-ghost input-xs h-6 min-h-0 w-16 rounded px-1 text-right text-xs font-semibold tabular-nums"
          type="number"
          bind:value={mapState.zoom}
          max={22}
          min={0}
          step={0.1}
          onblur={() => {
            editingValue = null;
          }}
          autofocus
        />
      {:else}
        <button
          type="button"
          class="btn btn-ghost btn-xs h-6 min-h-0 min-w-12 rounded px-1 text-right text-xs font-semibold tabular-nums"
          onclick={() => {
            editingValue = "zoom";
          }}
        >
          {Number(mapState.zoom ?? 0).toFixed(1)}x
        </button>
      {/if}
    </div>
  {/if}
  {#if layer.clipPath}
    <div class="bg-base-200/70 flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
      <div class="text-base-content/80 flex items-center gap-1.5">
        <SquareDashedTopSolid class="size-3.5 shrink-0" />
        <span class="text-xs font-medium tracking-wide uppercase">Border</span>
      </div>
      <input
        aria-label="Layer border width"
        class="range range-sm range-primary grow"
        defaultValue={0}
        max={15}
        min={0}
        step={0.5}
        type="range"
        bind:value={layer.pathBorderWidth}
      />
      {#if editingValue === "border"}
        <input
          aria-label="Border width value"
          class="input input-ghost input-xs h-6 min-h-0 w-14 rounded px-1 text-right text-xs font-semibold tabular-nums"
          type="number"
          bind:value={layer.pathBorderWidth}
          max={15}
          min={0}
          step={0.5}
          onblur={() => {
            editingValue = null;
          }}
          autofocus
        />
      {:else}
        <button
          type="button"
          class="btn btn-ghost btn-xs h-6 min-h-0 min-w-12 rounded px-1 text-right text-xs font-semibold tabular-nums"
          onclick={() => {
            editingValue = "border";
          }}
        >
          {Number(layer.pathBorderWidth ?? 0).toFixed(1)}px
        </button>
      {/if}
    </div>
  {/if}
</div>
