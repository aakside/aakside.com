declare module "@americana/maplibre-shield-generator" {
  export interface RouteShieldParser {
    parse(id: string): { network: string; ref: string; name: string };
    format(network: string, ref: string, name: string): string;
  }

  export class URLShieldRenderer {
    constructor(url: string, parser: RouteShieldParser);
    filterImageID(predicate: (imageID: string) => boolean): this;
    renderOnMaplibreGL(map: import("maplibre-gl").Map): this;
  }
}
