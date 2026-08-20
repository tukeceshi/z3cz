/** mp4 must not go through the asset cache — iPhone cannot play cached videos. */
export function shouldSeedBootstrapAssetCache(assetPath: string): boolean {
  return !assetPath.endsWith(".mp4");
}

export function shouldInterceptBootstrapAssetFetch(pathname: string): boolean {
  if (
    !pathname.startsWith("/assets/") &&
    !pathname.startsWith("/landing/")
  ) {
    return false;
  }
  return shouldSeedBootstrapAssetCache(pathname);
}
