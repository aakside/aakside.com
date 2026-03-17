<script lang="ts">
  interface Props {
    configJson?: string;
  }

  let { configJson = $bindable(undefined) }: Props = $props();
</script>

<div class="p-0">
  <textarea class="textarea" placeholder="Paste configuration JSON here" bind:value={configJson}
  ></textarea>
</div>

<style lang="postcss">
</style>
