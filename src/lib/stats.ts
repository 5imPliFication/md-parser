export function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split(/\r\n|\r|\n/).length;
}

export function estimateSize(source: string): string {
  const bytes = new TextEncoder().encode(source).length;

  if (bytes < 1024) {
    return `~${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `~${(bytes / 1024).toFixed(1)} KB`;
  }

  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
