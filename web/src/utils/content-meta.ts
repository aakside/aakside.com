import type { CollectionEntry } from "astro:content";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { GITHUB_REPO_URL } from "../consts";
import { BLOG_FILE_EXTENSIONS, PROJECTS_FILE_EXTENSIONS } from "../content.config";

type SupportedCollection = "blog" | "projects";
type EntryWithDates<C extends SupportedCollection> = CollectionEntry<C> & {
  data: CollectionEntry<C>["data"] & {
    pubDate: Date;
    updatedDate: Date;
  };
};

const collectionFileExtensions: Record<SupportedCollection, string[]> = {
  blog: BLOG_FILE_EXTENSIONS,
  projects: PROJECTS_FILE_EXTENSIONS,
};

const gitTimestampCache = new Map<string, number | undefined>();
const gitHashCache = new Map<string, string>();
const gitPathCache = new Map<string, string>();

function runGitLog(args: string[]): string[] {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getLastCommitHash(filePath: string): string | undefined {
  const cacheKey = `hash:last:${filePath}`;
  if (!gitHashCache.has(cacheKey)) {
    const lines = runGitLog(["log", "-1", "--format=%H", "--", filePath]);
    gitHashCache.set(cacheKey, lines[0] ?? undefined);
  }
  return gitHashCache.get(cacheKey);
}

function getLastCommitTimestampSeconds(filePath: string): number | undefined {
  const cacheKey = `last:${filePath}`;
  if (!gitTimestampCache.has(cacheKey)) {
    const lines = runGitLog(["log", "-1", "--format=%ct", "--", filePath]);
    const value = lines.length > 0 ? Number.parseInt(lines[0], 10) : Number.NaN;
    const timestamp = Number.isFinite(value) ? value : undefined;
    gitTimestampCache.set(cacheKey, timestamp);
  }
  return gitTimestampCache.get(cacheKey);
}

function getFirstCommitTimestampSeconds(filePath: string): number | undefined {
  const cacheKey = `first:${filePath}`;
  if (!gitTimestampCache.has(cacheKey)) {
    const lines = runGitLog(["log", "--diff-filter=A", "--follow", "--format=%ct", "--", filePath]);
    const oldestLine = lines.length > 0 ? lines[lines.length - 1] : undefined;
    const value = oldestLine ? Number.parseInt(oldestLine, 10) : Number.NaN;
    const timestamp = Number.isFinite(value) ? value : undefined;
    gitTimestampCache.set(cacheKey, timestamp);
  }
  return gitTimestampCache.get(cacheKey);
}

function getContentPath<C extends SupportedCollection>(
  collection: C,
  id: string,
): string | undefined {
  const basePath = path.join("src", "content", collection, id);
  return collectionFileExtensions[collection]
    .map((extension) => `${basePath}.${extension}`)
    .find((path) => existsSync(path));
}

function getRepoRelativePath(filePath: string): string | undefined {
  const cacheKey = `repo:${filePath}`;
  if (!gitPathCache.has(cacheKey)) {
    const lines = runGitLog(["ls-files", "--full-name", "--", filePath]);
    gitPathCache.set(cacheKey, lines[0] ?? undefined);
  }
  return gitPathCache.get(cacheKey);
}

export function getGitHubRepoPathForEntry<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): string | undefined {
  const contentPath = getContentPath<C>(entry.collection as C, entry.id);
  return contentPath ? (getRepoRelativePath(contentPath) ?? contentPath) : undefined;
}

export function latestCommitDiffUrlForEntry<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): string | undefined {
  const contentPath = getContentPath<C>(entry.collection as C, entry.id);
  const lastCommitHash = contentPath ? getLastCommitHash(contentPath) : undefined;
  const repoPath = getGitHubRepoPathForEntry(entry);
  const diffHash = repoPath ? createHash("sha256").update(repoPath).digest("hex") : undefined;
  return (
    lastCommitHash && diffHash && `${GITHUB_REPO_URL}/commit/${lastCommitHash}#diff-${diffHash}`
  );
}

export function withGitContentDates<C extends SupportedCollection>(
  entry: CollectionEntry<C>,
): EntryWithDates<C> {
  const contentPath = getContentPath<C>(entry.collection as C, entry.id);
  let pubDate = entry.data.pubDate;
  let updatedDate = entry.data.updatedDate ?? pubDate;

  if (contentPath) {
    const firstCommit = getFirstCommitTimestampSeconds(contentPath);
    const lastCommit = getLastCommitTimestampSeconds(contentPath);
    pubDate = firstCommit ? new Date(firstCommit * 1000) : pubDate;
    updatedDate = lastCommit ? new Date(lastCommit * 1000) : updatedDate;
  }

  return {
    ...entry,
    data: {
      ...entry.data,
      pubDate,
      updatedDate,
    },
  };
}
