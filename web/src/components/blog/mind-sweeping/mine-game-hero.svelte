<script lang="ts">
  import MineGame, { CELL_SIZE, WIDTH_OVERHEAD, HEIGHT_OVERHEAD } from "./mine-game.svelte";

  const MIN_COLS = 9;
  const MIN_ROWS = 9;
  const minHeight = MIN_ROWS * CELL_SIZE + HEIGHT_OVERHEAD;

  let containerEl: HTMLDivElement | undefined = $state();
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  const cols = $derived(
    Math.max(MIN_COLS, Math.floor((containerWidth - WIDTH_OVERHEAD) / CELL_SIZE)),
  );
  const rows = $derived(
    Math.max(MIN_ROWS, Math.floor((containerHeight - HEIGHT_OVERHEAD) / CELL_SIZE)),
  );

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
    <MineGame width={cols} height={rows} />
  {/if}
</div>
