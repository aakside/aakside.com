<script lang="ts">
  import { X } from "@lucide/svelte";
</script>

<dialog id="app-info" class="modal">
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-square tooltip tooltip-info absolute top-2 right-2"
        ><X /></button
      >
    </form>
    <h3 class="text-lg font-bold">Borders Without Borders</h3>
    <p class="pt-4 pb-0">
      This is a tool inspired by <a
        class="link"
        href="http://radicalcartography.net/manhattan.html"
        target="_blank"
        rel="noopener">William Rankin's "The Errant Isle"</a
      > that lets you move/overlay geographic areas anywhere on Earth.
    </p>
    <p class="pt-4 pb-0">
      Read more about it in <a class="link" href="/blog/wherever-isle-may-roam" target="_blank"
        >this blog post</a
      >.
    </p>
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
