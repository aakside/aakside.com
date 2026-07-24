<script lang="ts">
  import { onMount } from "svelte";

  type Slide = {
    captionHtml: string;
    imageHref?: string;
    mediaHtml: string;
    slideId: string;
  };

  interface Props {
    ariaLabel?: string;
    class?: string;
    id: string;
  }

  let { ariaLabel = "Media carousel", class: classList, id: carouselId }: Props = $props();

  const LIST_SELECTOR = ":scope > ul, :scope > ol";
  const MEDIA_SELECTOR = "canvas,figure,iframe,img,lite-youtube,picture,svg,video";

  let currentIdx = $state(0);
  let slides = $state<Slide[]>([]);
  let slotContainer: HTMLDivElement | undefined = $state();

  function isIgnoredElementNode(node: ChildNode) {
    return (
      node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "script"
    );
  }

  function isMeaningfulNode(node: ChildNode) {
    if (isIgnoredElementNode(node)) {
      return false;
    }

    return node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim());
  }

  function normalizeText(value: string) {
    return value.replace(/\s+/g, " ").trim();
  }

  function stripTrailingBulletMarker(container: HTMLElement) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let lastText: Text | undefined;

    while (walker.nextNode()) {
      const currentText = walker.currentNode as Text;
      if (currentText.textContent?.trim()) {
        lastText = currentText;
      }
    }

    if (!lastText) {
      return false;
    }

    const value = lastText.textContent ?? "";
    if (!/\s-\s*$/.test(value)) {
      return false;
    }

    lastText.textContent = value.replace(/\s*-\s*$/, "");
    return true;
  }

  function serializeMediaNode(mediaNode: Element) {
    const mediaClone = mediaNode.cloneNode(true) as Element;
    mediaClone.querySelectorAll("script").forEach((node) => node.remove());

    if (mediaClone.tagName.toLowerCase() === "lite-youtube") {
      mediaClone.querySelectorAll("noscript").forEach((node) => node.remove());
    }

    return mediaClone.outerHTML;
  }

  function getImageElement(mediaNode: Element) {
    if (mediaNode.tagName.toLowerCase() === "img") {
      return mediaNode as HTMLImageElement;
    }

    if (mediaNode.tagName.toLowerCase() === "picture") {
      const nestedImage = mediaNode.querySelector("img");
      if (nestedImage instanceof HTMLImageElement) {
        return nestedImage;
      }
    }

    return null;
  }

  function getOriginalImageHref(mediaNode: Element) {
    const image = getImageElement(mediaNode);
    const src = image?.getAttribute("src");

    if (!src) {
      return undefined;
    }

    try {
      const url = new URL(src, document.baseURI);

      if (url.pathname === "/_image") {
        const originalHref = url.searchParams.get("href");
        return originalHref?.split("?")[0] || undefined;
      }

      return src.split("?")[0];
    } catch {
      return src.split("?")[0];
    }
  }

  function parseSlidesFromBulletNodes(slotRoot: HTMLElement, nextSlides: Slide[]) {
    const nodes = Array.from(slotRoot.childNodes).filter(isMeaningfulNode);

    const mediaIndexes = nodes
      .map((node, index) =>
        node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(MEDIA_SELECTOR)
          ? index
          : -1,
      )
      .filter((index) => index >= 0);

    if (mediaIndexes.length === 0) {
      return false;
    }

    const leadingNodes = nodes.slice(0, mediaIndexes[0]);
    if (normalizeText(leadingNodes.map((node) => node.textContent ?? "").join(" ")) !== "-") {
      throw new Error(
        `[Carousel:${carouselId}] MDX bullet slides must start with a bullet marker before the first media element.`,
      );
    }

    for (const [slideIndex, mediaNodeIndex] of mediaIndexes.entries()) {
      const nextMediaIndex =
        slideIndex + 1 < mediaIndexes.length ? mediaIndexes[slideIndex + 1] : nodes.length;
      const mediaNode = nodes[mediaNodeIndex] as Element;
      const captionNodes = nodes.slice(mediaNodeIndex + 1, nextMediaIndex);
      const captionContentNodes = captionNodes.filter((node) => !isIgnoredElementNode(node));

      if (captionContentNodes.length === 0) {
        throw new Error(
          `[Carousel:${carouselId}] Bullet slide ${slideIndex + 1} is missing caption content.`,
        );
      }

      const captionContainer = document.createElement("div");

      for (const node of captionContentNodes) {
        const clone = node.cloneNode(true) as ChildNode;
        captionContainer.append(clone);
      }

      if (slideIndex < mediaIndexes.length - 1 && !stripTrailingBulletMarker(captionContainer)) {
        throw new Error(
          `[Carousel:${carouselId}] Bullet slide ${slideIndex + 1} must end with a bullet marker before the next media element.`,
        );
      }

      nextSlides.push({
        captionHtml: captionContainer.innerHTML.trim(),
        imageHref: getOriginalImageHref(mediaNode),
        mediaHtml: serializeMediaNode(mediaNode),
        slideId: `${carouselId}-${nextSlides.length}`,
      });
    }

    return true;
  }

  function parseSlidesFromSlot() {
    if (!slotContainer) {
      slides = [];
      currentIdx = 0;
      return;
    }

    const nextSlides: Slide[] = [];

    const slotRoot =
      (slotContainer.querySelector(":scope > astro-slot") as HTMLElement | null) ?? slotContainer;
    const listRoot = slotRoot.querySelector(LIST_SELECTOR);

    if (!listRoot) {
      const parsedBulletSlides = parseSlidesFromBulletNodes(slotRoot, nextSlides);
      if (!parsedBulletSlides) {
        throw new Error(
          `[Carousel:${carouselId}] Slot content must be either a top-level <ul>/<ol> with <li> slides, or MDX bullet slides (\`- <Media /> caption\`).`,
        );
      }

      slides = nextSlides;
      currentIdx = Math.min(currentIdx, Math.max(nextSlides.length - 1, 0));
      slotContainer.replaceChildren();
      return;
    }

    const listItems = Array.from(listRoot.children).filter(
      (child) => child.tagName.toLowerCase() === "li",
    );

    if (listItems.length === 0) {
      throw new Error(
        `[Carousel:${carouselId}] The top-level list must contain at least one <li> slide.`,
      );
    }

    for (const [index, listItem] of listItems.entries()) {
      const mediaNodes = listItem.querySelectorAll(MEDIA_SELECTOR);
      if (mediaNodes.length !== 1) {
        throw new Error(
          `[Carousel:${carouselId}] Slide ${index + 1} must contain exactly one media node matching (${MEDIA_SELECTOR}); found ${mediaNodes.length}.`,
        );
      }

      const mediaNode = mediaNodes[0];

      const captionContainer = listItem.cloneNode(true) as HTMLElement;
      captionContainer.querySelector(MEDIA_SELECTOR)?.remove();
      captionContainer.querySelectorAll("script").forEach((node) => node.remove());

      nextSlides.push({
        captionHtml: captionContainer.innerHTML.trim(),
        imageHref: getOriginalImageHref(mediaNode),
        mediaHtml: serializeMediaNode(mediaNode),
        slideId: `${carouselId}-${nextSlides.length}`,
      });
    }

    slides = nextSlides;
    currentIdx = Math.min(currentIdx, Math.max(nextSlides.length - 1, 0));
    slotContainer.replaceChildren();
  }

  function goTo(index: number) {
    if (slides.length === 0) {
      return;
    }

    const normalizedIndex = ((index % slides.length) + slides.length) % slides.length;
    currentIdx = normalizedIndex;

    const slideEl = document.getElementById(slides[normalizedIndex].slideId);
    slideEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  onMount(() => {
    parseSlidesFromSlot();
  });
</script>

<figure class={classList}>
  <div class="hidden" aria-hidden="true" bind:this={slotContainer}>
    <!-- svelte-ignore slot_element_deprecated -->
    <slot />
  </div>

  {#if slides.length > 0}
    <div class="relative">
      <div class="carousel w-full rounded-xl">
        {#each slides as slide}
          <div
            id={slide.slideId}
            class="carousel-item relative w-full justify-center *:h-full *:w-full [&_img]:m-0 [&_lite-youtube]:max-w-none"
            aria-label={ariaLabel}
          >
            {#if slide.imageHref}
              <a
                href={slide.imageHref}
                target="_blank"
                rel="noopener noreferrer"
                class="block h-full w-full"
                aria-label="Open original image"
              >
                {@html slide.mediaHtml}
              </a>
            {:else}
              {@html slide.mediaHtml}
            {/if}
          </div>
        {/each}
      </div>

      <div
        class="pointer-events-none absolute top-1/2 right-5 left-5 flex -translate-y-1/2 justify-between"
      >
        <button
          type="button"
          class="btn btn-circle bg-neutral/50 pointer-events-auto"
          aria-label="Previous item"
          onclick={() => goTo(currentIdx - 1)}
        >
          ❮
        </button>
        <button
          type="button"
          class="btn btn-circle bg-neutral/50 pointer-events-auto"
          aria-label="Next item"
          onclick={() => goTo(currentIdx + 1)}
        >
          ❯
        </button>
      </div>
    </div>

    <figcaption>
      {#if slides[currentIdx].captionHtml}
        <div class="[&>*:first-child]:mt-0! [&>*:last-child]:mb-0!">
          {@html slides[currentIdx].captionHtml}
        </div>
      {:else}
        {ariaLabel}
      {/if}
    </figcaption>
  {:else}
    <figcaption>{ariaLabel}</figcaption>
  {/if}
</figure>
