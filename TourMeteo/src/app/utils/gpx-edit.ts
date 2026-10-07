/**
 * Fonctions pures pour l'éditeur GPX (lecture, écriture, géométrie).
 * Aucune dépendance Angular ni Leaflet : facile à tester.
 */

export interface EditPoint {
  lat: number;
  lon: number;
  /** Altitude en mètres (optionnelle) */
  ele?: number;
  /** Horodatage ISO 8601 (optionnel) */
  time?: string;
}

export interface ParsedGpx {
  name: string;
  points: EditPoint[];
  /** Nombre de segments/traces fusionnés dans la liste de points */
  segments: number;
}

const EARTH_RADIUS_M = 6371000;

/** Taille maximale d'un fichier accepté (octets) */
export const MAX_GPX_BYTES = 15 * 1024 * 1024;

export function haversineMeters(a: EditPoint, b: EditPoint): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function totalDistanceKm(points: EditPoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversineMeters(points[i - 1], points[i]);
  return m / 1000;
}

/** Dénivelé positif cumulé (m), en ignorant les variations < 1 m (bruit GPS) */
export function elevationGain(points: EditPoint[]): number | null {
  let gain = 0;
  let last: number | null = null;
  let seen = false;
  for (const p of points) {
    if (p.ele === undefined) continue;
    seen = true;
    if (last !== null && p.ele - last >= 1) gain += p.ele - last;
    if (last === null || Math.abs(p.ele - last) >= 1) last = p.ele;
  }
  return seen ? Math.round(gain) : null;
}

/** Lit un fichier GPX (trkpt, à défaut rtept). Lève une Error avec un message lisible. */
export function parseGpx(xml: string, fallbackName = 'Parcours'): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Fichier GPX invalide ou corrompu.');
  }

  const byName = (root: Document | Element, tag: string): Element[] =>
    Array.from(root.getElementsByTagNameNS('*', tag));

  let nodes = byName(doc, 'trkpt');
  let segments = byName(doc, 'trkseg').length;
  if (nodes.length === 0) {
    nodes = byName(doc, 'rtept');
    segments = byName(doc, 'rte').length;
  }

  const points: EditPoint[] = [];
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat') ?? '');
    const lon = parseFloat(n.getAttribute('lon') ?? '');
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const p: EditPoint = { lat, lon };
    const ele = n.getElementsByTagNameNS('*', 'ele')[0]?.textContent;
    if (ele !== undefined && ele !== null && isFinite(parseFloat(ele))) p.ele = parseFloat(ele);
    const time = n.getElementsByTagNameNS('*', 'time')[0]?.textContent?.trim();
    if (time && !isNaN(Date.parse(time))) p.time = time;
    points.push(p);
  }

  if (points.length === 0) throw new Error('Aucun point de trace trouvé dans ce fichier GPX.');

  const trkName = byName(doc, 'trk')[0]?.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim();
  const metaName = byName(doc, 'metadata')[0]?.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim();
  return { name: trkName || metaName || fallbackName, points, segments: Math.max(1, segments) };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Produit un GPX 1.1 (le nom est échappé : un « & » ou « < » ne casse pas le fichier) */
export function buildGpx(name: string, points: EditPoint[]): string {
  const safe = escapeXml(name.trim() || 'Parcours');
  const pts = points.map(p => {
    const inner = (p.ele !== undefined ? `<ele>${p.ele}</ele>` : '') + (p.time ? `<time>${escapeXml(p.time)}</time>` : '');
    const head = `      <trkpt lat="${+p.lat.toFixed(7)}" lon="${+p.lon.toFixed(7)}"`;
    return inner ? `${head}>${inner}</trkpt>` : `${head}/>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Meteo Ride" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safe}</name>
  </metadata>
  <trk>
    <name>${safe}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Nom de fichier sûr (sans caractères interdits sous Windows/macOS) */
export function safeFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').slice(0, 80);
  return (cleaned || 'parcours') + '.gpx';
}

/** Projette (lat, lon) en mètres locaux (approximation plane suffisante sur quelques dizaines de km) */
function toMeters(p: EditPoint, refLat: number): { x: number; y: number } {
  const k = Math.PI / 180 * EARTH_RADIUS_M;
  return { x: p.lon * k * Math.cos(refLat * Math.PI / 180), y: p.lat * k };
}

/**
 * Point le plus proche d'une position sur le tracé.
 * Renvoie l'index du segment (entre `segment` et `segment + 1`), le paramètre t ∈ [0, 1] sur ce segment,
 * et la distance en mètres.
 */
export function nearestOnPath(points: EditPoint[], target: EditPoint): { segment: number; t: number; distanceM: number } | null {
  if (points.length < 2) return null;
  const t0 = toMeters(target, target.lat);
  let best = { segment: 0, t: 0, distanceM: Infinity };
  let prev = toMeters(points[0], target.lat);
  for (let i = 0; i < points.length - 1; i++) {
    const next = toMeters(points[i + 1], target.lat);
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((t0.x - prev.x) * dx + (t0.y - prev.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(prev.x + t * dx - t0.x, prev.y + t * dy - t0.y);
    if (d < best.distanceM) best = { segment: i, t, distanceM: d };
    prev = next;
  }
  return best;
}

/** Crée un point à (lat, lon) en interpolant altitude et heure entre deux voisins quand elles existent */
export function interpolatedPoint(lat: number, lon: number, a?: EditPoint, b?: EditPoint, t = 0.5): EditPoint {
  const p: EditPoint = { lat, lon };
  if (a && b) {
    if (a.ele !== undefined && b.ele !== undefined) p.ele = +(a.ele + (b.ele - a.ele) * t).toFixed(1);
    if (a.time && b.time) {
      const ta = Date.parse(a.time);
      const tb = Date.parse(b.time);
      p.time = new Date(ta + (tb - ta) * t).toISOString();
    }
  } else if (a || b) {
    const ref = (a ?? b)!;
    if (ref.ele !== undefined) p.ele = ref.ele;
  }
  return p;
}

/**
 * Simplification de Douglas-Peucker (version itérative : pas de dépassement de pile sur 50 000 points).
 * `toleranceM` : écart maximal toléré par rapport au tracé d'origine.
 */
export function simplify(points: EditPoint[], toleranceM: number): EditPoint[] {
  const n = points.length;
  if (n < 3 || toleranceM <= 0) return points.slice();
  const refLat = points[0].lat;
  const xy = points.map(p => toMeters(p, refLat));
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const ax = xy[s].x, ay = xy[s].y;
    const dx = xy[e].x - ax, dy = xy[e].y - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      let t = len2 === 0 ? 0 : ((xy[i].x - ax) * dx + (xy[i].y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx - xy[i].x, ay + t * dy - xy[i].y);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Vrai si toutes les heures présentes sont croissantes (ou s'il n'y en a aucune) */
export function timesAreConsistent(points: EditPoint[]): boolean {
  const withTime = points.filter(p => p.time).length;
  if (withTime === 0) return true;
  if (withTime !== points.length) return false; // heures partielles : incohérent
  for (let i = 1; i < points.length; i++) {
    if (Date.parse(points[i].time!) < Date.parse(points[i - 1].time!)) return false;
  }
  return true;
}

/**
 * Inverse le sens du tracé. Les heures gardent leur ordre chronologique
 * (le point de départ garde l'heure de départ), sinon elles seraient décroissantes.
 */
export function reversePoints(points: EditPoint[]): EditPoint[] {
  const times = points.map(p => p.time);
  return points.slice().reverse().map((p, i) => {
    const { time: _drop, ...rest } = p;
    return times[i] ? { ...rest, time: times[i] } : rest;
  });
}

export interface MergeResult {
  points: EditPoint[];
  /** Le fichier ajouté a été retourné pour minimiser l'écart entre les deux tracés */
  reversed: boolean;
  /** Distance (m) entre le point de jonction des deux tracés */
  gapM: number;
  /** Les heures ont été retirées car elles se chevauchent ou sont partielles */
  timesDropped: boolean;
}

/** Fusionne `added` à la suite (ou avant) de `base`, en l'orientant automatiquement si demandé */
export function mergeTracks(base: EditPoint[], added: EditPoint[], position: 'end' | 'start', autoOrient: boolean): MergeResult {
  if (!base.length || !added.length) throw new Error('Rien à fusionner.');
  let b = added;
  let reversed = false;
  if (autoOrient) {
    const straight = position === 'end'
      ? haversineMeters(base[base.length - 1], added[0])
      : haversineMeters(added[added.length - 1], base[0]);
    const flipped = position === 'end'
      ? haversineMeters(base[base.length - 1], added[added.length - 1])
      : haversineMeters(added[0], base[0]);
    if (flipped < straight) { b = reversePoints(added); reversed = true; }
  }
  const merged = position === 'end' ? [...base, ...b] : [...b, ...base];
  const gapM = position === 'end'
    ? haversineMeters(base[base.length - 1], b[0])
    : haversineMeters(b[b.length - 1], base[0]);
  let timesDropped = false;
  let points = merged;
  if (!timesAreConsistent(merged)) {
    points = merged.map(({ time: _t, ...rest }) => rest);
    timesDropped = merged.some(p => p.time);
  }
  return { points, reversed, gapM, timesDropped };
}

/** Scinde au point `index` : les deux parties partagent ce point pour rester continues */
export function splitAt(points: EditPoint[], index: number): [EditPoint[], EditPoint[]] {
  if (index <= 0 || index >= points.length - 1) throw new Error('Choisissez un point à l\'intérieur du tracé.');
  return [points.slice(0, index + 1), points.slice(index)];
}
