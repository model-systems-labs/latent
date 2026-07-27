const applicationBasePath =
  typeof process === "undefined"
    ? ""
    : process.env.__NEXT_ROUTER_BASEPATH ?? "";

export function publicAssetPath(path: `/${string}`): string {
  if (!applicationBasePath) return path;
  return `${applicationBasePath}${path}`;
}
