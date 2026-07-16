import type { CollectionEntry, CollectionKey } from "astro:content";

export type TimelineEntryShape = {
  startDate: Date | [Date, Date];
  sortDate: Date;
  title: string;
};

export type TimelineCollectionKey = {
  [K in CollectionKey]: CollectionEntry<K>["data"] extends TimelineEntryShape ? K : never;
}[CollectionKey];

export type TimelineCollectionEntry<
  TCollection extends TimelineCollectionKey = TimelineCollectionKey,
> = CollectionEntry<TCollection>;
