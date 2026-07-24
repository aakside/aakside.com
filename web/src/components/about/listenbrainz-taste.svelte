<script lang="ts">
  import { onMount } from "svelte";

  type StatsRange =
    | "this_week"
    | "this_month"
    | "this_year"
    | "week"
    | "month"
    | "quarter"
    | "year"
    | "half_yearly"
    | "all_time";

  type TopArtist = {
    artist_name: string;
    listen_count: number;
  };

  type ListenCountResponse = {
    payload?: {
      count?: number;
    };
  };

  type TopArtistsResponse = {
    payload?: {
      artists?: TopArtist[];
      last_updated?: number;
    };
  };

  type CachedPayload = {
    cachedAt: number;
    totalListens?: number;
    topArtists: TopArtist[];
    lastUpdated?: number;
  };

  interface Props {
    cacheMs?: number;
    count?: number;
    range?: StatsRange;
    username?: string;
  }

  let {
    cacheMs = 1000 * 60 * 30,
    count = 8,
    range = "all_time",
    username = "aakside",
  }: Props = $props();

  const API_ROOT = "https://api.listenbrainz.org/1";

  let isLoading = $state(true);
  let error = $state<string | undefined>(undefined);
  let totalListens = $state<number | undefined>(undefined);
  let topArtists = $state<TopArtist[]>([]);
  let lastUpdated = $state<number | undefined>(undefined);

  const cacheKey = $derived(`listenbrainz:taste:${username}:${range}:${count}`);

  function formatNumber(value: number) {
    return new Intl.NumberFormat().format(value);
  }

  function formatDate(epochSeconds: number) {
    return new Date(epochSeconds * 1000).toLocaleDateString();
  }

  async function fetchJson<T>(url: string): Promise<T | null> {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`ListenBrainz request failed (${response.status})`);
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    return JSON.parse(text) as T;
  }

  function readCache() {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (!raw) {
        return false;
      }

      const cached = JSON.parse(raw) as CachedPayload;
      if (Date.now() - cached.cachedAt > cacheMs) {
        return false;
      }

      totalListens = cached.totalListens;
      topArtists = cached.topArtists;
      lastUpdated = cached.lastUpdated;
      return true;
    } catch {
      return false;
    }
  }

  function writeCache() {
    if (typeof window === "undefined") {
      return;
    }

    const payload: CachedPayload = {
      cachedAt: Date.now(),
      lastUpdated,
      topArtists,
      totalListens,
    };

    window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  }

  async function loadMusicTaste(forceRefresh = false) {
    isLoading = true;
    error = undefined;

    if (!forceRefresh && readCache()) {
      isLoading = false;
      return;
    }

    try {
      const [listenCountResponse, topArtistsResponse] = await Promise.all([
        fetchJson<ListenCountResponse>(
          `${API_ROOT}/user/${encodeURIComponent(username)}/listen-count`,
        ),
        fetchJson<TopArtistsResponse>(
          `${API_ROOT}/stats/user/${encodeURIComponent(username)}/artists?range=${encodeURIComponent(range)}&count=${encodeURIComponent(String(count))}`,
        ),
      ]);

      totalListens = listenCountResponse?.payload?.count;
      topArtists = topArtistsResponse?.payload?.artists ?? [];
      lastUpdated = topArtistsResponse?.payload?.last_updated;
      writeCache();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown error";
      error = `Could not load ListenBrainz stats: ${message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void loadMusicTaste();
  });
</script>

<section class="not-prose border-base-300/70 bg-base-100/70 my-4 rounded-xl border p-4">
  <div class="mb-3 flex items-start justify-between gap-3">
    <p class="m-0 text-sm leading-relaxed opacity-90">
      Live public data from
      <a
        href={`https://listenbrainz.org/user/${username}/`}
        target="_blank"
        rel="noopener noreferrer"
      >
        ListenBrainz
      </a>
      for @{username}.
      {#if totalListens !== undefined}
        <span class="font-medium"> {formatNumber(totalListens)} total listens.</span>
      {/if}
    </p>
    <button type="button" class="btn btn-xs btn-ghost" onclick={() => void loadMusicTaste(true)}>
      Refresh
    </button>
  </div>

  {#if isLoading}
    <p class="m-0 text-sm opacity-70">Loading taste snapshot...</p>
  {:else if error}
    <p class="text-warning m-0 text-sm">{error}</p>
  {:else if topArtists.length === 0}
    <p class="m-0 text-sm opacity-70">No top-artist stats are available yet for this range.</p>
  {:else}
    <ol class="m-0 space-y-1 pl-5">
      {#each topArtists as artist}
        <li class="flex items-baseline justify-between gap-2">
          <span class="truncate">{artist.artist_name}</span>
          <span class="shrink-0 text-xs opacity-70"
            >{formatNumber(artist.listen_count)} listens</span
          >
        </li>
      {/each}
    </ol>
    {#if lastUpdated}
      <p class="mt-3 mb-0 text-xs opacity-70">Stats last updated: {formatDate(lastUpdated)}</p>
    {/if}
  {/if}

  <p class="mt-3 mb-0 text-xs opacity-60">
    ListenBrainz documents rate limits and exposes public listen data under CC0.
  </p>
</section>
