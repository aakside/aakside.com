import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const BLOG_FILE_EXTENSIONS = ["md", "mdx"];
export const PROJECTS_FILE_EXTENSIONS = ["json", "md", "mdx", "toml", "yaml", "yml"];
export const TIMELINE_FILE_EXTENSIONS = ["json", "md", "mdx"];

function isValidTimelineDateRange([start, end]: [Date, Date]): boolean {
  return start.getTime() < end.getTime();
}

function hasSingleGrapheme(value: string): boolean {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined") {
    const graphemes = [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value),
    ];
    return graphemes.length === 1;
  }
  return Array.from(value).length === 1;
}

export function defineTimelineCollection(base: string) {
  return defineCollection({
    loader: glob({
      base,
      pattern: `**/*.{${TIMELINE_FILE_EXTENSIONS.join(",")}}`,
    }),
    schema: ({ image }) => {
      const timelineDateRangeSchema = z
        .array(z.coerce.date())
        .length(2, { message: "Date range must contain exactly two bounds." })
        .transform((range) => [range[0], range[1]] as [Date, Date])
        .refine(isValidTimelineDateRange, {
          message: "Date range start must be before range end.",
        });

      return z
        .object({
          endDate: z.union([z.coerce.date(), timelineDateRangeSchema]).optional(),
          description: z.string().optional(),
          icon: z
            .union([
              image(),
              z
                .string()
                .trim()
                .refine((value) => hasSingleGrapheme(value), {
                  message: "Icon text must be exactly one character.",
                }),
            ])
            .optional(),
          link: z.string().optional(),
          startDate: z.union([z.coerce.date(), timelineDateRangeSchema]),
          title: z.string(),
        })
        .transform((data) => {
          return {
            ...data,
            sortDate: Array.isArray(data.startDate)
              ? new Date((data.startDate[0].getTime() + data.startDate[1].getTime()) / 2)
              : data.startDate,
          };
        });
    },
  });
}

const professionalExperience = defineTimelineCollection("./src/content/professional-experience");

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: `**/*.{${BLOG_FILE_EXTENSIONS.join(",")}}` }),
  schema: ({ image }) =>
    z.object({
      description: z.string(),
      favicon: z.string().optional(),
      heroAlt: z.string().optional(),
      heroComponent: z.string().optional(),
      heroImage: image().optional(),
      pubDate: z.coerce.date(),
      title: z.string(),
      updatedDate: z.coerce.date().optional(),
    }),
});

const projects = defineCollection({
  loader: glob({
    base: "./src/content/projects",
    pattern: `**/*.{${PROJECTS_FILE_EXTENSIONS.join(",")}}`,
  }),
  schema: ({ image }) =>
    z
      .object({
        component: z.string().optional(),
        description: z.string(),
        favicon: z.string().optional(),
        heroAlt: z.string().optional(),
        heroImage: image().optional(),
        minimalLayout: z.boolean().optional(),
        page: z.string().optional(),
        pubDate: z.coerce.date(),
        title: z.string(),
        updatedDate: z.coerce.date().optional(),
      })
      .transform((data) => {
        const page = data.page?.trim().replace(/^\/+|\/+$/g, "");
        data.page = page || undefined;

        if (!data.updatedDate) {
          data.updatedDate = data.pubDate;
        }
        return data;
      }),
});

export const collections = { professionalExperience, blog, projects };
