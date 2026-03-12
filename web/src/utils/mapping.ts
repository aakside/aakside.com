const WGS84_EQUATORIAL_RADIUS_METERS = 6378137;

export function zoom(
  desiredWidthMeters: number,
  containerWidthPixels: number,
  latitude: number,
): number {
  const equatorialCircumference = 2 * Math.PI * WGS84_EQUATORIAL_RADIUS_METERS;
  const targetMpp = desiredWidthMeters / containerWidthPixels;
  const minZoomMpp = (Math.cos((latitude * Math.PI) / 180) * equatorialCircumference) / 512;
  return Math.log2(minZoomMpp / targetMpp);
}
