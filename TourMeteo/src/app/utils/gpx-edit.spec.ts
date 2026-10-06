import { describe, it, expect } from 'vitest';
import { EditPoint, buildGpx, interpolatedPoint, nearestOnPath, parseGpx, safeFileName, simplify, totalDistanceKm } from './gpx-edit';

const line = (n: number): EditPoint[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 50 + i * 0.001, lon: 3, ele: 10 + i, time: new Date(Date.UTC(2026, 0, 1, 8, 0, i)).toISOString() }));

describe('gpx-edit', () => {
  it('relit ce qu\'il écrit (aller-retour)', () => {
    const pts = line(5);
    const parsed = parseGpx(buildGpx('Sortie du matin', pts));
    expect(parsed.name).toBe('Sortie du matin');
    expect(parsed.points).toHaveLength(5);
    expect(parsed.points[2].ele).toBe(12);
    expect(parsed.points[2].time).toBe(pts[2].time);
  });

  it('échappe le nom dans le XML', () => {
    const xml = buildGpx('Tour <A&B> "x"', line(2));
    expect(xml).not.toContain('<A&B>');
    expect(parseGpx(xml).name).toBe('Tour <A&B> "x"');
  });

  it('ignore les points invalides et refuse un fichier sans trace', () => {
    const xml = '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="abc" lon="1"/><trkpt lat="91" lon="1"/><trkpt lat="45" lon="2"/></trkseg></trk></gpx>';
    expect(parseGpx(xml).points).toEqual([{ lat: 45, lon: 2 }]);
    expect(() => parseGpx('<gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>')).toThrow();
    expect(() => parseGpx('pas du xml <')).toThrow();
  });

  it('lit les routes (rtept) quand il n\'y a pas de trace', () => {
    const xml = '<gpx xmlns="http://www.topografix.com/GPX/1/1"><rte><rtept lat="45" lon="2"/><rtept lat="45.1" lon="2"/></rte></gpx>';
    expect(parseGpx(xml).points).toHaveLength(2);
  });

  it('calcule la distance (≈ 111 km par degré de latitude)', () => {
    expect(totalDistanceKm([{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }])).toBeCloseTo(111.2, 0);
  });

  it('trouve le segment le plus proche et le paramètre t', () => {
    const pts: EditPoint[] = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0, lon: 0.02 }];
    const n = nearestOnPath(pts, { lat: 0.0005, lon: 0.015 })!;
    expect(n.segment).toBe(1);
    expect(n.t).toBeCloseTo(0.5, 1);
    expect(nearestOnPath([pts[0]], pts[1])).toBeNull();
  });

  it('interpole altitude et heure entre deux points', () => {
    const p = interpolatedPoint(1, 1, { lat: 0, lon: 0, ele: 100, time: '2026-01-01T08:00:00.000Z' }, { lat: 2, lon: 2, ele: 200, time: '2026-01-01T08:10:00.000Z' }, 0.5);
    expect(p.ele).toBe(150);
    expect(p.time).toBe('2026-01-01T08:05:00.000Z');
  });

  it('simplifie sans toucher aux extrémités et supporte 50 000 points', () => {
    const straight = line(50000);
    const s = simplify(straight, 5);
    expect(s.length).toBe(2);
    expect(s[0]).toBe(straight[0]);
    expect(s[1]).toBe(straight[49999]);
    const bent: EditPoint[] = [{ lat: 0, lon: 0 }, { lat: 0.01, lon: 0.01 }, { lat: 0, lon: 0.02 }];
    expect(simplify(bent, 5)).toHaveLength(3);
  });

  it('nettoie le nom de fichier', () => {
    expect(safeFileName('a/b:c*?.gpx')).toBe('a_b_c__.gpx.gpx');
    expect(safeFileName('   ')).toBe('parcours.gpx');
  });
});
