/**
 * Piecewise-linear scroll mapping between two panes. Each anchor is a pair of
 * positions (e.g. where a Markdown block starts in the editor and where its
 * rendered element starts in the preview). Scrolling between two anchors in
 * one pane lands proportionally between the same two anchors in the other.
 */
export interface ScrollMap {
  from: number[];
  to: number[];
}

/**
 * Builds a monotonic map from paired anchor positions, framed by the top
 * (0 ↔ 0) and the bottom (fromMax ↔ toMax). Anchors that would make the map
 * go backwards or past the bottom are dropped.
 */
export function buildScrollMap(
  fromAnchors: readonly number[],
  toAnchors: readonly number[],
  fromMax: number,
  toMax: number,
): ScrollMap {
  const from = [0];
  const to = [0];
  const count = Math.min(fromAnchors.length, toAnchors.length);

  for (let i = 0; i < count; i++) {
    const f = fromAnchors[i] ?? 0;
    const t = toAnchors[i] ?? 0;
    const lastF = from[from.length - 1] ?? 0;
    const lastT = to[to.length - 1] ?? 0;

    if (f > lastF && t > lastT && f < fromMax && t < toMax) {
      from.push(f);
      to.push(t);
    }
  }

  if (fromMax > 0 && toMax > 0) {
    from.push(fromMax);
    to.push(toMax);
  }

  return { from, to };
}

export function mapScroll(position: number, map: ScrollMap): number {
  const { from, to } = map;
  const last = from.length - 1;
  if (last < 1) return 0;

  if (position <= 0) return 0;
  if (position >= (from[last] ?? 0)) return to[last] ?? 0;

  // Binary search for the segment containing `position`.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((from[mid] ?? 0) <= position) lo = mid;
    else hi = mid;
  }

  const f0 = from[lo] ?? 0;
  const f1 = from[hi] ?? 0;
  const t0 = to[lo] ?? 0;
  const t1 = to[hi] ?? 0;
  return t0 + ((position - f0) / (f1 - f0)) * (t1 - t0);
}

/** The same map read in the other direction. */
export function invertScrollMap(map: ScrollMap): ScrollMap {
  return { from: map.to, to: map.from };
}
