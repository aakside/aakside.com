declare module "virtual:theme" {
  export type Theme = Record<string, string>;
  export const themes: Record<string, Theme | undefined>;
  export const theme: Theme;
}
