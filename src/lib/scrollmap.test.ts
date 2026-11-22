import { describe, expect, it } from 'vitest';
import { buildScrollMap, invertScrollMap, mapScroll } from './scrollmap';

describe('buildScrollMap', () => {
  it('frames anchors with the top and bottom of both panes', () => {
    expect(buildScrollMap([100, 200], [300, 900], 400, 1200)).toEqual({
      from: [0, 100, 200, 400],
      to: [0, 300, 900, 1200],
    });
  });

  it('drops anchors that go backwards, repeat, or pass the bottom', () => {
    expect(buildScrollMap([0, 100, 90, 150, 500], [0, 200, 250, 200, 600], 400, 1000)).toEqual({
      from: [0, 100, 400],
      to: [0, 200, 1000],
    });
  });

  it('has no bottom point when a pane cannot scroll', () => {
    expect(buildScrollMap([10], [10], 0, 500)).toEqual({ from: [0], to: [0] });
  });
});

describe('mapScroll', () => {
  const map = buildScrollMap([100, 200], [300, 900], 400, 1200);

  it('hits anchors exactly', () => {
    expect(mapScroll(100, map)).toBe(300);
    expect(mapScroll(200, map)).toBe(900);
  });

  it('interpolates between anchors', () => {
    expect(mapScroll(50, map)).toBe(150);
    expect(mapScroll(150, map)).toBe(600);
    expect(mapScroll(300, map)).toBe(1050);
  });

  it('clamps outside the scroll range', () => {
    expect(mapScroll(-20, map)).toBe(0);
    expect(mapScroll(9999, map)).toBe(1200);
  });

  it('returns 0 for a map with no range', () => {
    expect(mapScroll(50, { from: [0], to: [0] })).toBe(0);
  });

  it('round-trips through the inverted map', () => {
    const back = invertScrollMap(map);
    for (const y of [0, 37, 100, 180, 333, 400]) {
      expect(mapScroll(mapScroll(y, map), back)).toBeCloseTo(y);
    }
  });
});
