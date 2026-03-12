import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      description: z.string(),
      favicon: z.string().optional(),
      heroImage: image().optional(),
      pubDate: z.coerce.date(),
      title: z.string(),
      updatedDate: z.coerce.date().optional(),
    }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{json,md,mdx,toml,yaml,yml}" }),
  schema: ({ image }) =>
    z
      .object({
        component: z.string().optional(),
        description: z.string(),
        favicon: z.string().optional(),
        heroImage: image().optional(),
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
