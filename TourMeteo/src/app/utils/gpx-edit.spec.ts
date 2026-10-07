import { describe, it, expect } from 'vitest';
import { distributeTimes, parseBRouter, parseOsrm } from './routing';
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

describe('routing', () => {
  it('lit la réponse de BRouter avec altitude', () => {
    const pts = parseBRouter({ features: [{ geometry: { coordinates: [[3.1, 45.1, 120], [3.2, 45.2, 130.5]] } }] });
    expect(pts).toEqual([{ lat: 45.1, lon: 3.1, ele: 120 }, { lat: 45.2, lon: 3.2, ele: 130.5 }]);
    expect(() => parseBRouter({})).toThrow();
  });

  it('lit la réponse d\'OSRM et refuse une erreur', () => {
    expect(parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[3, 45], [3.1, 45.1]] } }] })).toHaveLength(2);
    expect(() => parseOsrm({ code: 'NoRoute', routes: [] })).toThrow();
  });

  it('répartit les heures selon la distance parcourue', () => {
    const a = { lat: 0, lon: 0, time: '2026-01-01T08:00:00.000Z' };
    const b = { lat: 0, lon: 0.02, time: '2026-01-01T08:20:00.000Z' };
    const out = distributeTimes([a, { lat: 0, lon: 0.005 }, { lat: 0, lon: 0.01 }, b], a, b);
    expect(out[1].time).toBe('2026-01-01T08:05:00.000Z');
    expect(out[2].time).toBe('2026-01-01T08:10:00.000Z');
    expect(distributeTimes([a, { lat: 0, lon: 0.01 }, b], { lat: 0, lon: 0 }, b)[1].time).toBeUndefined();
  });
});

import { mergeTracks, reversePoints, splitAt, timesAreConsistent } from './gpx-edit';

describe('fusion, scission, inversion', () => {
  const t = (s: number) => new Date(Date.UTC(2026, 0, 1, 8, 0, s)).toISOString();
  const pt = (lat: number, s?: number): EditPoint => (s === undefined ? { lat, lon: 3 } : { lat, lon: 3, time: t(s) });

  it('inverser garde des heures croissantes', () => {
    const r = reversePoints([pt(1, 0), pt(2, 10), pt(3, 20)]);
    expect(r.map(p => p.lat)).toEqual([3, 2, 1]);
    expect(r.map(p => p.time)).toEqual([t(0), t(10), t(20)]);
    expect(timesAreConsistent(r)).toBe(true);
  });

  it('fusionne à la suite en retournant le fichier ajouté si c\'est plus proche', () => {
    const a = [pt(0), pt(1)];
    const b = [pt(3), pt(2)]; // son DÉBUT est loin de la fin de a, sa FIN est proche
    const m = mergeTracks(a, b, 'end', true);
    expect(m.reversed).toBe(true);
    expect(m.points.map(p => p.lat)).toEqual([0, 1, 2, 3]);
    expect(m.gapM).toBeGreaterThan(100000);
    expect(mergeTracks(a, b, 'end', false).points.map(p => p.lat)).toEqual([0, 1, 3, 2]);
  });

  it('fusionne au début', () => {
    const m = mergeTracks([pt(5), pt(6)], [pt(3), pt(4)], 'start', true);
    expect(m.points.map(p => p.lat)).toEqual([3, 4, 5, 6]);
  });

  it('retire les heures quand les fichiers se chevauchent ou qu\'elles sont partielles', () => {
    const overlap = mergeTracks([pt(0, 100), pt(1, 200)], [pt(2, 50), pt(3, 60)], 'end', false);
    expect(overlap.timesDropped).toBe(true);
    expect(overlap.points.every(p => p.time === undefined)).toBe(true);
    const ok = mergeTracks([pt(0, 0), pt(1, 10)], [pt(2, 20), pt(3, 30)], 'end', false);
    expect(ok.timesDropped).toBe(false);
    expect(ok.points[3].time).toBe(t(30));
    expect(mergeTracks([pt(0, 0)], [pt(1)], 'end', false).timesDropped).toBe(true);
  });

  it('scinde en deux parties qui partagent le point de coupe', () => {
    const [p1, p2] = splitAt([pt(0), pt(1), pt(2), pt(3), pt(4)], 2);
    expect(p1.map(p => p.lat)).toEqual([0, 1, 2]);
    expect(p2.map(p => p.lat)).toEqual([2, 3, 4]);
    expect(() => splitAt([pt(0), pt(1), pt(2)], 0)).toThrow();
    expect(() => splitAt([pt(0), pt(1), pt(2)], 2)).toThrow();
  });
});
