import type { CollectionEntry } from "astro:content";
import { GITHUB_REPO_URL } from "../consts";
import { contentGitMeta } from "../generated/content-git-meta";

type SupportedCollection = "blog" | "professionalExperience" | "projects";
type EntryWithDates<C extends SupportedCollection> = CollectionEntry<C> & {
  data: CollectionEntry<C>["data"] & {
    pubDate: Date;
    updatedDate: Date;
  };
};

/**
 * Git metadata is resolved ahead of the build by
 * `scripts/generate-content-git-meta.mjs`, because Astro prerenders inside
 * workerd where `node:child_process` does not exist. Everything here is a
 * lookup against that generated table.
 */
function gitMetaForEntry<C extends SupportedCollection>(entry: CollectionEntry<C>) {
  return contentGitMeta[entry.collection]?.[entry.id];
}

export function getGitHubRepoPathForEntry<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): string | undefined {
  return gitMetaForEntry(entry)?.repoPath;
}

export function latestCommitDiffUrlForEntry<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): string | undefined {
  const gitMeta = gitMetaForEntry(entry);
  return (
    gitMeta?.lastCommitHash &&
    `${GITHUB_REPO_URL}/commit/${gitMeta.lastCommitHash}#diff-${gitMeta.diffHash}`
  );
}

export function withGitContentDates<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): EntryWithDates<C> {
  const gitMeta = gitMetaForEntry(entry);
  const frontmatterPubDate = entry.data.pubDate;
  const frontmatterUpdatedDate = entry.data.updatedDate ?? frontmatterPubDate;

  return {
    ...entry,
    data: {
      ...entry.data,
      pubDate: gitMeta?.firstCommitSeconds
        ? new Date(gitMeta.firstCommitSeconds * 1000)
        : frontmatterPubDate,
      updatedDate: gitMeta?.lastCommitSeconds
        ? new Date(gitMeta.lastCommitSeconds * 1000)
        : frontmatterUpdatedDate,
    },
  };
}
