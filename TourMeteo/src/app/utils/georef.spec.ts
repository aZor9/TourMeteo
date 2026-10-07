import { describe, it, expect } from 'vitest';
import { EditPoint } from './gpx-edit';
import { fitAgainstRoads, isUngeoreferenced, placeTrack } from './georef';

// Forme en « L » en coordonnées proches de (0, 0) : ~1,1 km de long
const shape: EditPoint[] = [
  { lat: 0, lon: 0 }, { lat: 0, lon: 0.005 }, { lat: 0, lon: 0.01 },
  { lat: 0.005, lon: 0.01 }, { lat: 0.01, lon: 0.01 }
];

describe('georef', () => {
  it('détecte un tracé non géolocalisé', () => {
    expect(isUngeoreferenced(shape)).toBe(true);
    expect(isUngeoreferenced([{ lat: 45, lon: 5 }])).toBe(false);
  });

  it('place le premier point sur l\'ancre et garde l\'altitude', () => {
    const placed = placeTrack([{ ...shape[0], ele: 12 }, shape[1]], { anchor: { lat: 45, lon: 5 }, rotationDeg: 0, scale: 1 });
    expect(placed[0].lat).toBeCloseTo(45, 6);
    expect(placed[0].lon).toBeCloseTo(5, 6);
    expect(placed[0].ele).toBe(12);
    expect(placed[1].lon).toBeGreaterThan(5);
  });

  it('une rotation de 90° horaire envoie l\'est vers le sud', () => {
    const placed = placeTrack([shape[0], shape[1]], { anchor: { lat: 45, lon: 5 }, rotationDeg: 90, scale: 1 });
    expect(placed[1].lat).toBeLessThan(45);
    expect(Math.abs(placed[1].lon - 5)).toBeLessThan(1e-6);
  });

  it('rapproche le tracé des routes quand le placement est un peu décalé', () => {
    const truth = { anchor: { lat: 45, lon: 5 }, rotationDeg: 0, scale: 1 };
    const roads = [placeTrack(shape, truth).map(p => ({ lat: p.lat, lon: p.lon }))];
    const off = { anchor: { lat: 45 + 0.0004, lon: 5 + 0.0005 }, rotationDeg: 4, scale: 1 };
    const r = fitAgainstRoads(shape, off, roads);
    expect(r.afterM).toBeLessThan(r.beforeM);
    expect(r.afterM).toBeLessThan(10);
  });
});
