<script lang="ts">
  import { onMount } from "svelte";
  import ListenBrainzIcon from "../../assets/external-links/listenbrainz.svg";

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

  type StatsType = "artist" | "album" | "track";

  type StatsQuery = {
    range: StatsRange;
    type: StatsType;
  };

  type TopArtist = {
    artist_name: string;
    listen_count: number;
  };

  type TopRelease = {
    artist_name?: string;
    listen_count: number;
    release_name?: string;
  };

  type TopRecording = {
    artist_name?: string;
    listen_count: number;
    track_name?: string;
  };

  type TopItem = {
    listenCount: number;
    subtitle?: string;
    title: string;
  };

  type TopStatsResponse = {
    payload?: {
      artists?: TopArtist[];
      recordings?: TopRecording[];
      releases?: TopRelease[];
      last_updated?: number;
    };
  };

  type CachedPayload = {
    cachedAt: number;
    topItems: TopItem[];
    lastUpdated?: number;
  };

  type QuerySnapshot = {
    error?: string;
    lastUpdated?: number;
    query: StatsQuery;
    topItems: TopItem[];
  };

  interface Props {
    cacheMs?: number;
    count?: number;
    queries?: StatsQuery[];
    username?: string;
  }

  let {
    cacheMs = 1000 * 60 * 30,
    count = 8,
    queries = [{ range: "all_time", type: "artist" }],
    username = "aakside",
  }: Props = $props();

  const API_ROOT = "https://api.listenbrainz.org/1";

  let isLoading = $state(true);
  let querySnapshots = $state<QuerySnapshot[]>([]);

  const VALID_RANGES = new Set<StatsRange>([
    "this_week",
    "this_month",
    "this_year",
    "week",
    "month",
    "quarter",
    "year",
    "half_yearly",
    "all_time",
  ]);

  const VALID_TYPES = new Set<StatsType>(["artist", "album", "track"]);

  function normalizeRange(value: unknown): StatsRange | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    if (VALID_RANGES.has(normalized as StatsRange)) {
      return normalized as StatsRange;
    }

    return null;
  }

  function normalizeType(value: unknown): StatsType | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    if (VALID_TYPES.has(normalized as StatsType)) {
      return normalized as StatsType;
    }

    return null;
  }

  function normalizeQuery(value: unknown): StatsQuery | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const query = value as { range?: unknown; type?: unknown };
    const normalizedRange = normalizeRange(query.range);
    const normalizedType = normalizeType(query.type);

    if (!normalizedRange || !normalizedType) {
      return null;
    }

    return {
      range: normalizedRange,
      type: normalizedType,
    };
  }

  const requestedQueries = $derived.by(() => {
    const normalized = queries
      .map((query) => normalizeQuery(query))
      .filter((query): query is StatsQuery => query !== null);

    if (normalized.length === 0) {
      return [{ range: "all_time", type: "artist" }] as StatsQuery[];
    }

    const uniqueQueries = new Map<string, StatsQuery>();
    for (const query of normalized) {
      uniqueQueries.set(`${query.type}:${query.range}`, query);
    }

    return Array.from(uniqueQueries.values());
  });

  function endpointForType(statsType: StatsType) {
    if (statsType === "album") {
      return "releases";
    }

    if (statsType === "track") {
      return "recordings";
    }

    return "artists";
  }

  function typeLabel(statsType: StatsType) {
    if (statsType === "album") {
      return "Albums";
    }

    if (statsType === "track") {
      return "Tracks";
    }

    return "Artists";
  }

  function normalizeTopItems(statsType: StatsType, payload: TopStatsResponse["payload"]) {
    if (!payload) {
      return [] as TopItem[];
    }

    if (statsType === "album") {
      return (payload.releases ?? []).map((release) => ({
        listenCount: release.listen_count,
        subtitle: release.artist_name,
        title: release.release_name || "(Untitled album)",
      }));
    }

    if (statsType === "track") {
      return (payload.recordings ?? []).map((recording) => ({
        listenCount: recording.listen_count,
        subtitle: recording.artist_name,
        title: recording.track_name || "(Untitled track)",
      }));
    }

    return (payload.artists ?? []).map((artist) => ({
      listenCount: artist.listen_count,
      title: artist.artist_name,
    }));
  }

  function formatDate(epochSeconds: number) {
    return new Date(epochSeconds * 1000).toLocaleDateString();
  }

  function formatRangeLabel(statsRange: StatsRange | string) {
    return String(statsRange).replace(/_/g, " ");
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

  function cacheKeyFor(query: StatsQuery) {
    return `listenbrainz:taste:${username}:${query.type}:${query.range}:${count}`;
  }

  function readCache(query: StatsQuery) {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(cacheKeyFor(query));
      if (!raw) {
        return null;
      }

      const cached = JSON.parse(raw) as CachedPayload;
      if (Date.now() - cached.cachedAt > cacheMs) {
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  }

  function writeCache(query: StatsQuery, payload: CachedPayload) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(cacheKeyFor(query), JSON.stringify(payload));
  }

  async function loadQuerySnapshot(query: StatsQuery, forceRefresh = false) {
    const cached = forceRefresh ? null : readCache(query);
    if (cached) {
      return {
        lastUpdated: cached.lastUpdated,
        query,
        topItems: cached.topItems,
      } satisfies QuerySnapshot;
    }

    try {
      const endpoint = endpointForType(query.type);
      const topStatsResponse = await fetchJson<TopStatsResponse>(
        `${API_ROOT}/stats/user/${encodeURIComponent(username)}/${endpoint}?range=${encodeURIComponent(query.range)}&count=${encodeURIComponent(String(count))}`,
      );

      const topItems = normalizeTopItems(query.type, topStatsResponse?.payload);
      const lastUpdated = topStatsResponse?.payload?.last_updated;

      writeCache(query, {
        cachedAt: Date.now(),
        lastUpdated,
        topItems,
      });

      return {
        lastUpdated,
        query,
        topItems,
      } satisfies QuerySnapshot;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown error";
      return {
        error: `Could not load ListenBrainz stats: ${message}`,
        query,
        topItems: [],
      } satisfies QuerySnapshot;
    }
  }

  async function loadMusicTaste(forceRefresh = false) {
    isLoading = true;
    try {
      querySnapshots = await Promise.all(
        requestedQueries.map((query) => loadQuerySnapshot(query, forceRefresh)),
      );
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void loadMusicTaste();
  });
</script>

<details class="collapse-arrow bg-base-300 collapse relative space-y-3 overflow-visible rounded-xl">
  <summary class="collapse-title m-0 font-semibold">Listening stats</summary>
  {#if isLoading}
    <div class="collapse-content flex flex-wrap gap-4">
      {#each requestedQueries as query}
        <div class="bg-secondary/5 w-full flex-1 rounded-sm p-3 py-1">
          <p class="text-sm">
            Loading {typeLabel(query.type)} for {formatRangeLabel(query.range)}...
          </p>
        </div>
      {/each}
    </div>
  {:else}
    <div
      class="bg-neutral border-primary/10 absolute right-0 -bottom-3 z-30 flex gap-1 rounded-lg border px-1 pt-0 pb-1"
    >
      <div class="tooltip" data-tip="See more stats">
        <a
          class="btn btn-primary h-6 w-6 rounded-md p-0"
          href={`https://listenbrainz.org/user/${username}/stats/?range=all_time`}
          rel="noopener noreferrer"
          target="_blank"
          ><img src={ListenBrainzIcon.src} alt="ListenBrainz" class="h-full w-full" /></a
        >
      </div>
      <div class="tooltip" data-tip="Refresh listening stats">
        <button
          type="button"
          class="btn btn-primary h-6 w-6 rounded-md p-0"
          onclick={() => void loadMusicTaste(true)}>🗘</button
        >
      </div>
    </div>
    <div class="collapse-content flex flex-wrap gap-2 p-2">
      {#each querySnapshots as snapshot}
        <div class="bg-base-200/25 min-w-2xs flex-1 rounded-sm px-3 py-1">
          <p class="mt-2! mb-0! text-sm font-bold">
            Top {typeLabel(snapshot.query.type)} ({formatRangeLabel(snapshot.query.range)}) by
            listen count
          </p>

          {#if snapshot.lastUpdated}
            <p class="mt-0 text-xs">Last updated: {formatDate(snapshot.lastUpdated)}</p>
          {/if}

          {#if snapshot.error}
            <p class="mt-2 text-sm">{snapshot.error}</p>
          {:else if snapshot.topItems.length === 0}
            <p class="mt-2 text-sm">
              No top-{snapshot.query.type} stats are available yet for this range.
            </p>
          {:else}
            <ol class="mt-2 mb-0 list-none space-y-1 pl-0 text-sm marker:text-xs marker:font-bold">
              {#each snapshot.topItems as item}
                <li>
                  <span class="font-mono text-xs">{item.listenCount.toLocaleString()}:</span>
                  <span class="text-sm font-bold">{item.title}</span>
                  {#if item.subtitle}
                    <span class="text-xs opacity-75"> — {item.subtitle}</span>
                  {/if}
                </li>
              {/each}
            </ol>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</details>
