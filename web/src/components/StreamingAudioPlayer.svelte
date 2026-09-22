<script lang="ts">
  type StreamingServiceId =
    | "spotify"
    | "tidal"
    | "amazonMusic"
    | "appleMusic"
    | "qobuz"
    | "youtubeMusic"
    | "deezer"
    | "soundcloud"
    | "custom";

  type QobuzSource = "track" | "album" | "playlist" | "partner";

  type StreamingEntry = {
    service: StreamingServiceId;
    id?: string;
    url?: string;
    embedUrl?: string;
    label?: string;
    appleStorefront?: string;
    appleSlug?: string;
    qobuzSource?: QobuzSource;
  };

  interface Props {
    entries: StreamingEntry[];
    class?: string;
    title?: string;
    defaultService?: StreamingServiceId;
  }

  type NormalizedEntry = {
    service: StreamingServiceId;
    label: string;
    embedUrl: string;
  };

  let { entries, class: classList, title = "Listen", defaultService }: Props = $props();

  const SERVICE_LABELS: Record<StreamingServiceId, string> = {
    amazonMusic: "Amazon Music",
    appleMusic: "Apple Music",
    custom: "Custom",
    deezer: "Deezer",
    qobuz: "Qobuz",
    soundcloud: "SoundCloud",
    spotify: "Spotify",
    tidal: "TIDAL",
    youtubeMusic: "YouTube Music",
  };

  const IFRAME_ALLOW = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

  const normalizedEntries = $derived(buildNormalizedEntries(entries));
  let selectedService = $state<StreamingServiceId | "">(defaultService ?? "");

  $effect(() => {
    if (!normalizedEntries.length) {
      selectedService = "";
      return;
    }

    if (!selectedService || !normalizedEntries.some((entry) => entry.service === selectedService)) {
      selectedService = normalizedEntries[0].service;
    }
  });

  const activeEntry = $derived(
    normalizedEntries.find((entry) => entry.service === selectedService) ?? normalizedEntries[0],
  );

  function cleanId(id: string | undefined) {
    return id?.trim() || "";
  }

  function buildSpotifyEmbed(id: string) {
    return `https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=generator`;
  }

  function buildTidalEmbed(id: string) {
    return `https://embed.tidal.com/tracks/${encodeURIComponent(id)}?layout=gridify`;
  }

  function buildAmazonMusicEmbed(id: string) {
    return `https://music.amazon.com/embed/${encodeURIComponent(id)}`;
  }

  function buildAppleMusicEmbed(entry: StreamingEntry) {
    const id = cleanId(entry.id);
    if (!id) {
      return undefined;
    }

    const storefront = (entry.appleStorefront || "us").trim();
    const slug = (entry.appleSlug || "track").trim();
    return `https://embed.music.apple.com/${encodeURIComponent(storefront)}/song/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`;
  }

  function buildQobuzEmbed(entry: StreamingEntry) {
    const id = cleanId(entry.id);
    if (!id) {
      return undefined;
    }

    const source = entry.qobuzSource || "track";
    return `https://open.qobuz.com/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
  }

  function buildYouTubeMusicEmbed(id: string) {
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }

  function buildDeezerEmbed(id: string) {
    return `https://widget.deezer.com/widget/dark/track/${encodeURIComponent(id)}`;
  }

  function buildSoundCloudEmbed(url: string) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`;
  }

  function buildEmbedUrl(entry: StreamingEntry) {
    const directEmbedUrl = entry.embedUrl?.trim();
    if (directEmbedUrl) {
      return directEmbedUrl;
    }

    const id = cleanId(entry.id);
    switch (entry.service) {
      case "spotify":
        return id ? buildSpotifyEmbed(id) : undefined;
      case "tidal":
        return id ? buildTidalEmbed(id) : undefined;
      case "amazonMusic":
        return id ? buildAmazonMusicEmbed(id) : undefined;
      case "appleMusic":
        return buildAppleMusicEmbed(entry);
      case "qobuz":
        return buildQobuzEmbed(entry);
      case "youtubeMusic":
        return id ? buildYouTubeMusicEmbed(id) : undefined;
      case "deezer":
        return id ? buildDeezerEmbed(id) : undefined;
      case "soundcloud": {
        const sourceUrl = entry.url?.trim();
        return sourceUrl ? buildSoundCloudEmbed(sourceUrl) : undefined;
      }
      case "custom":
      default:
        return undefined;
    }
  }

  function buildNormalizedEntries(allEntries: StreamingEntry[]) {
    const nextEntries: NormalizedEntry[] = [];

    for (const entry of allEntries) {
      const embedUrl = buildEmbedUrl(entry);
      if (!embedUrl) {
        continue;
      }

      nextEntries.push({
        embedUrl,
        label: entry.label?.trim() || SERVICE_LABELS[entry.service],
        service: entry.service,
      });
    }

    return nextEntries;
  }
</script>

<div class={classList}>
  <div class="bg-base-300 rounded-xl p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="m-0! font-semibold max-sm:text-sm! sm:text-xl!">{title}</h3>
      {#if normalizedEntries.length > 1}
        <label class="flex items-center gap-2 text-sm">
          <select
            bind:value={selectedService}
            class="select select-xs sm:select-sm"
            aria-label="Select streaming service"
          >
            {#each normalizedEntries as entry}
              <option value={entry.service}>{entry.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    {#if activeEntry}
      <iframe
        title={`${activeEntry.label} player`}
        src={activeEntry.embedUrl}
        class="border-base-300 h-40 w-full rounded-lg border"
        loading="lazy"
        allow={IFRAME_ALLOW}
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    {:else}
      <p class="text-base-content/70 m-0 text-sm">
        No valid player source was provided. Add at least one entry with an ID or embed URL.
      </p>
    {/if}
  </div>
</div>
