/**
 * Compute the longest common directory prefix from a list of absolute file paths.
 * Returns the common root with a trailing slash, or '' if no common root exists.
 */
export function computeCommonRoot(paths: string[]): string {
  if (paths.length === 0) return '';

  const segments = paths[0].split('/');
  let commonLen = segments.length;

  for (const p of paths) {
    const s = p.split('/');
    commonLen = Math.min(commonLen, s.length);
    for (let i = 0; i < commonLen; i++) {
      if (s[i] !== segments[i]) {
        commonLen = i;
        break;
      }
    }
  }

  // For a single file, the common root is its parent directory
  if (paths.length === 1) {
    commonLen = Math.max(0, segments.length - 1);
  }

  if (commonLen === 0) return '';
  return segments.slice(0, commonLen).join('/') + '/';
}
