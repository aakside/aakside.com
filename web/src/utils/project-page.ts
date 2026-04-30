import type { CollectionEntry } from "astro:content";

export function getProjectPagePath(project: CollectionEntry<"projects">): string {
  const customPage = project.data.page ? project.data.page.trim().replace(/^\/+|\/+$/g, "") : "";
  return customPage || project.id;
}

export function getProjectPermalink(project: CollectionEntry<"projects">): string {
  return `/${getProjectPagePath(project)}/`;
}
