import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const BLOG_FILE_EXTENSIONS = ["md", "mdx"];
export const PROJECTS_FILE_EXTENSIONS = ["json", "md", "mdx", "toml", "yaml", "yml"];

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: `**/*.{${BLOG_FILE_EXTENSIONS.join(",")}}` }),
  schema: ({ image }) =>
    z.object({
      description: z.string(),
      favicon: z.string().optional(),
      heroAlt: z.string().optional(),
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
        pubDate: z.coerce.date(),
        title: z.string(),
        updatedDate: z.coerce.date().optional(),
      })
      .transform((data) => {
        if (!data.updatedDate) {
          data.updatedDate = data.pubDate;
        }
        return data;
      }),
});

export const collections = { blog, projects };
