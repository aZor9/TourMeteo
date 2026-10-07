/**
 * Placement d'un tracé « sans position » sur la carte, puis ajustement automatique aux routes.
 * Fonctions pures (sauf `autoFitToRoads` qui interroge Overpass) : aucune dépendance Angular ni Leaflet.
 */
import { EditPoint } from './gpx-edit';
import { RoutingProfile } from './routing';

/** Mètres par degré de latitude */
const K = Math.PI / 180 * 6371000;

export interface Placement {
  /** Où tombe le premier point du tracé */
  anchor: { lat: number; lon: number };
  /** Rotation en degrés, sens horaire sur la carte, autour du point de départ */
  rotationDeg: number;
  /** Facteur de taille (1 = taille d'origine) */
  scale: number;
}

export interface RoadPoint { lat: number; lon: number; }

export interface FitResult {
  placement: Placement;
  /** Écart moyen aux routes (m) avant / après, plafonné à `CAP_M` */
  beforeM: number;
  afterM: number;
}

const CAP_M = 80;
const CELL_M = 80;
/** Étendue maximale (degrés) pour l'ajustement automatique : au-delà, la requête de routes est trop lourde */
const MAX_SPAN_DEG = 0.25;

/** Vrai si tous les points sont à moins de 1° de (0, 0) : typique d'un tracé non géolocalisé */
export function isUngeoreferenced(points: EditPoint[]): boolean {
  return points.length > 0 && points.every(p => Math.abs(p.lat) < 1 && Math.abs(p.lon) < 1);
}

interface XY { x: number; y: number; }

/** Forme du tracé en mètres, relative à son premier point */
function localShape(points: EditPoint[]): XY[] {
  const p0 = points[0];
  const kx = K * Math.cos(p0.lat * Math.PI / 180);
  return points.map(p => ({ x: (p.lon - p0.lon) * kx, y: (p.lat - p0.lat) * K }));
}

function transform(s: XY, rotRad: number, scale: number): XY {
  const c = Math.cos(rotRad), sn = Math.sin(rotRad);
  return { x: (s.x * c + s.y * sn) * scale, y: (-s.x * sn + s.y * c) * scale };
}

/** Applique un placement au tracé (altitude et heures conservées) */
export function placeTrack(points: EditPoint[], pl: Placement): EditPoint[] {
  if (!points.length) return [];
  const shape = localShape(points);
  const rot = pl.rotationDeg * Math.PI / 180;
  const kx = K * Math.cos(pl.anchor.lat * Math.PI / 180);
  return points.map((p, i) => {
    const t = transform(shape[i], rot, pl.scale);
    return { ...p, lat: pl.anchor.lat + t.y / K, lon: pl.anchor.lon + t.x / kx };
  });
}

// ─── Index spatial des routes ───

class RoadIndex {
  private cells = new Map<number, number[]>();
  private kx: number;

  constructor(roads: RoadPoint[][], private origin: { lat: number; lon: number }) {
    this.kx = K * Math.cos(origin.lat * Math.PI / 180);
    for (const road of roads) {
      for (let i = 0; i < road.length; i++) {
        const a = this.toXY(road[i]);
        this.add(a.x, a.y);
        if (i === 0) continue;
        // On densifie : les routes droites n'ont que peu de nœuds OSM
        const b = this.toXY(road[i - 1]);
        const steps = Math.floor(Math.hypot(a.x - b.x, a.y - b.y) / 15);
        for (let s = 1; s < steps; s++) this.add(b.x + (a.x - b.x) * s / steps, b.y + (a.y - b.y) * s / steps);
      }
    }
  }

  private toXY(p: RoadPoint): XY {
    return { x: (p.lon - this.origin.lon) * this.kx, y: (p.lat - this.origin.lat) * K };
  }

  private key(cx: number, cy: number): number { return (cx + 50000) * 100000 + (cy + 50000); }

  private add(x: number, y: number): void {
    const k = this.key(Math.floor(x / CELL_M), Math.floor(y / CELL_M));
    const arr = this.cells.get(k);
    if (arr) arr.push(x, y); else this.cells.set(k, [x, y]);
  }

  /** Distance à la route la plus proche, plafonnée à CAP_M */
  nearest(x: number, y: number): number {
    const cx = Math.floor(x / CELL_M), cy = Math.floor(y / CELL_M);
    let best = CAP_M;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const arr = this.cells.get(this.key(cx + i, cy + j));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n += 2) {
          const d = Math.hypot(arr[n] - x, arr[n + 1] - y);
          if (d < best) best = d;
        }
      }
    }
    return best;
  }
}

/** Points régulièrement espacés le long de la forme (au plus `max`) */
function sampleShape(shape: XY[], max: number): XY[] {
  if (shape.length <= max) return shape;
  const cum = [0];
  for (let i = 1; i < shape.length; i++) cum.push(cum[i - 1] + Math.hypot(shape[i].x - shape[i - 1].x, shape[i].y - shape[i - 1].y));
  const total = cum[cum.length - 1];
  if (total === 0) return [shape[0]];
  const out: XY[] = [];
  let j = 0;
  for (let s = 0; s < max; s++) {
    const target = total * s / (max - 1);
    while (j < shape.length - 1 && cum[j] < target) j++;
    out.push(shape[j]);
  }
  return out;
}

interface Candidate { dx: number; dy: number; rot: number; scale: number; }

/**
 * Cherche le léger déplacement / rotation / changement de taille qui rapproche le plus le tracé des routes.
 * `roads` : polylignes de routes (lat/lon) couvrant la zone du tracé.
 */
export function fitAgainstRoads(base: EditPoint[], start: Placement, roads: RoadPoint[][]): FitResult {
  const index = new RoadIndex(roads, start.anchor);
  const samples = sampleShape(localShape(base), 80);

  const score = (c: Candidate): number => {
    const rot = (start.rotationDeg + c.rot) * Math.PI / 180;
    let sum = 0;
    for (const s of samples) {
      const t = transform(s, rot, start.scale * c.scale);
      sum += index.nearest(t.x + c.dx, t.y + c.dy);
    }
    return sum / samples.length;
  };

  let best: Candidate = { dx: 0, dy: 0, rot: 0, scale: 1 };
  let bestScore = score(best);
  const beforeM = bestScore;

  const pass = (radius: number, step: number, rotRange: number, rotStep: number, scaleRange: number, scaleStep: number): void => {
    const centre = best;
    for (let dx = -radius; dx <= radius; dx += step) {
      for (let dy = -radius; dy <= radius; dy += step) {
        for (let r = -rotRange; r <= rotRange + 1e-9; r += rotStep) {
          for (let sc = -scaleRange; sc <= scaleRange + 1e-9; sc += scaleStep) {
            const c: Candidate = { dx: centre.dx + dx, dy: centre.dy + dy, rot: centre.rot + r, scale: centre.scale * (1 + sc) };
            const v = score(c);
            if (v < bestScore - 1e-9) { bestScore = v; best = c; }
          }
        }
      }
    }
  };
  pass(360, 60, 12, 6, 0.08, 0.08);
  pass(60, 15, 3, 1.5, 0.03, 0.015);
  pass(15, 5, 1, 0.5, 0.01, 0.005);

  const kx = K * Math.cos(start.anchor.lat * Math.PI / 180);
  return {
    placement: {
      anchor: { lat: start.anchor.lat + best.dy / K, lon: start.anchor.lon + best.dx / kx },
      rotationDeg: start.rotationDeg + best.rot,
      scale: start.scale * best.scale
    },
    beforeM,
    afterM: bestScore
  };
}

// ─── Routes depuis OpenStreetMap (Overpass) ───

const HIGHWAYS: Record<RoutingProfile, string> = {
  bike: 'trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|cycleway|track|road|primary_link|secondary_link|tertiary_link|trunk_link',
  foot: 'primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|track|cycleway|steps|road|primary_link|secondary_link|tertiary_link'
};

export async function fetchRoads(placed: EditPoint[], profile: RoutingProfile): Promise<RoadPoint[][]> {
  const lats = placed.map(p => p.lat), lons = placed.map(p => p.lon);
  const margin = 0.006; // ≈ 650 m : de quoi bouger le tracé
  const s = Math.min(...lats) - margin, n = Math.max(...lats) + margin;
  const w = Math.min(...lons) - margin, e = Math.max(...lons) + margin;
  if (n - s > MAX_SPAN_DEG || e - w > MAX_SPAN_DEG) {
    throw new Error('Tracé trop grand pour l\'ajustement automatique (environ 25 km maximum) : placez-le à la main.');
  }
  const query = `[out:json][timeout:25];way["highway"~"^(${HIGHWAYS[profile]})$"](${s},${w},${n},${e});out geom;`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return parseOverpass(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export function parseOverpass(data: any): RoadPoint[][] {
  const ways: any[] = data?.elements ?? [];
  return ways
    .filter(w => Array.isArray(w.geometry) && w.geometry.length > 1)
    .map(w => w.geometry.map((g: any) => ({ lat: g.lat, lon: g.lon })));
}

/** Ajuste le placement sur les routes réelles autour du tracé */
export async function autoFitToRoads(base: EditPoint[], start: Placement, profile: RoutingProfile): Promise<FitResult> {
  let roads: RoadPoint[][];
  try {
    roads = await fetchRoads(placeTrack(base, start), profile);
  } catch (e: any) {
    if (e?.message?.startsWith('Tracé trop grand')) throw e;
    throw new Error('Impossible de récupérer les routes pour le moment : placez-le à la main.');
  }
  if (!roads.length) throw new Error('Aucune route trouvée autour du tracé : vérifiez son emplacement.');
  return fitAgainstRoads(base, start, roads);
}
