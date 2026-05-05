<script lang="ts">
  import MineGame, {
    CELL_SIZE,
    CELL_SIZE_MAX,
    WIDTH_OVERHEAD,
    HEIGHT_OVERHEAD,
    type GameMode,
  } from "./mine-game.svelte";

  const MIN_COLS = 9;
  const MIN_ROWS = 9;

  let containerEl: HTMLDivElement | undefined = $state();
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let mode = $state<GameMode>("maximized");

  const cellSize = $derived(mode === "maximized" ? CELL_SIZE_MAX : CELL_SIZE);
  const cols = $derived(
    Math.max(MIN_COLS, Math.floor((containerWidth - WIDTH_OVERHEAD) / cellSize)),
  );
  const rows = $derived(
    Math.max(MIN_ROWS, Math.floor((containerHeight - HEIGHT_OVERHEAD) / cellSize)),
  );
  const minHeight = $derived(MIN_ROWS * cellSize + HEIGHT_OVERHEAD);

  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      containerWidth = width;
      containerHeight = height;
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });
</script>

<div
  class="flex aspect-video w-full items-center justify-center"
  style="min-height: {minHeight}px"
  bind:this={containerEl}
>
  {#if containerWidth > 0}
    <MineGame width={cols} height={rows} bind:mode />
  {/if}
</div>
