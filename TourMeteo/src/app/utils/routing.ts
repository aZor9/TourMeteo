import { EditPoint, haversineMeters } from './gpx-edit';

export type RoutingProfile = 'bike' | 'foot';

/** Convertit la réponse GeoJSON de BRouter ([lon, lat, altitude]) en points */
export function parseBRouter(data: any): EditPoint[] {
  const coords: number[][] | undefined = data?.features?.[0]?.geometry?.coordinates;
  if (!coords?.length) throw new Error('BRouter : aucun itinéraire');
  return coords.map(c => (c.length > 2 && isFinite(c[2]) ? { lat: c[1], lon: c[0], ele: +c[2] } : { lat: c[1], lon: c[0] }));
}

/** Convertit la réponse d'OSRM (pas d'altitude) en points */
export function parseOsrm(data: any): EditPoint[] {
  const coords: number[][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
  if (data?.code !== 'Ok' || !coords?.length) throw new Error('OSRM : aucun itinéraire');
  return coords.map(c => ({ lat: c[1], lon: c[0] }));
}

async function getJson(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Itinéraire qui suit les routes entre plusieurs étapes (≥ 2).
 * BRouter d'abord (évite le gravier et les chemins privés), OSRM en secours.
 * Le premier et le dernier point renvoyés sont les étapes « aimantées » à la route.
 */
export async function routeThrough(waypoints: Array<{ lat: number; lon: number }>, profile: RoutingProfile): Promise<EditPoint[]> {
  if (waypoints.length < 2) throw new Error('Il faut au moins 2 étapes.');
  try {
    const lonlats = waypoints.map(p => `${p.lon},${p.lat}`).join('|');
    const brProfile = profile === 'bike' ? 'fastbike' : 'trekking';
    return parseBRouter(await getJson(`https://brouter.de/brouter?lonlats=${lonlats}&profile=${brProfile}&alternativeidx=0&format=geojson`, 12000));
  } catch {
    const coords = waypoints.map(p => `${p.lon},${p.lat}`).join(';');
    return parseOsrm(await getJson(`https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`, 12000));
  }
}

/**
 * Répartit les heures de `a` à `b` sur les points intermédiaires, proportionnellement à la distance parcourue.
 * Renvoie une copie : les points sans heure (a ou b sans `time`) sont inchangés.
 */
export function distributeTimes(path: EditPoint[], a: EditPoint, b: EditPoint): EditPoint[] {
  if (!a.time || !b.time || path.length < 3) return path;
  const ta = Date.parse(a.time);
  const tb = Date.parse(b.time);
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineMeters(path[i - 1], path[i]));
  const total = cum[cum.length - 1] || 1;
  return path.map((p, i) => (i === 0 || i === path.length - 1 ? p : { ...p, time: new Date(ta + (tb - ta) * (cum[i] / total)).toISOString() }));
}
