import { Component, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CityService } from '../../service/city.service';

/* ────────── Interfaces ────────── */

interface Waypoint {
  lat: number;
  lon: number;
  name: string;
  elevation?: number;
}

interface RouteStats {
  distanceKm: number;
  durationText: string;
  elevationUp: number;
  elevationDown: number;
  elevationProfile: number[];
  cycleLanePercent: number;
  roadTypes: { label: string; percent: number; color: string }[];
  surfaceTypes: { label: string; percent: number; color: string }[];
}

interface RoutePoint {
  lat: number;
  lon: number;
}

/* ────────── Component ────────── */

@Component({
  selector: 'app-route-creator',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './route-creator.component.html'
})
export class RouteCreatorComponent implements AfterViewInit, OnDestroy {

  /* ── Waypoints ── */
  waypoints: Waypoint[] = [];
  newCityName = '';
  addingCity = false;

  /* ── Targets (optional) ── */
  targetDistanceKm: number | null = null;
  targetElevationUp: number | null = null;

  /* ── Map state ── */
  mapReady = false;

  /* ── Preferences ── */
  mode: 'bike' | 'run' = 'bike';
  // Bike
  avoidHighways = true;
  avoidGravel = true;
  preferCycleLanes = true;
  // Run
  preferTrails = false;
  preferParks = false;

  /* ── State ── */
  loading = false;
  error = '';
  progressText = '';

  /* ── Results ── */
  routePoints: RoutePoint[] = [];
  stats: RouteStats | null = null;

  /* ── Map (private) ── */
  private mapInstance: any = null;
  private L: any = null;
  private waypointMarkers: any[] = [];
  private routeLayer: any = null;

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private cityService: CityService
  ) {}

  /* ═══════════════ Lifecycle ═══════════════ */

  async ngAfterViewInit() {
    await this.initMap();
  }

  ngOnDestroy() {
    this.mapInstance?.remove();
    this.mapInstance = null;
  }

  /* ═══════════════ Map init ═══════════════ */

  private async initMap() {
    const mod = await import('leaflet');
    this.L = (mod as any).default || mod;
    const el = document.getElementById('route-map');
    if (!el) return;

    this.mapInstance = this.L.map('route-map', { preferCanvas: true }).setView([46.8, 2.3], 6);

    // CartoDB Positron: faster CDN + cleaner look than default OSM
    const tileLayer = this.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://osm.org/">OSM</a>',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.mapInstance);

    // Mark map as ready once first tiles load
    tileLayer.once('load', () => {
      this.mapReady = true;
      this.cd.detectChanges();
    });
    // Fallback: mark ready after 3s even if event doesn't fire
    setTimeout(() => {
      if (!this.mapReady) { this.mapReady = true; this.cd.detectChanges(); }
    }, 3000);

    this.mapInstance.on('click', (e: any) => {
      this.addWaypointFromMap(e.latlng.lat, e.latlng.lng);
    });
  }

  /* ═══════════════ Waypoint management ═══════════════ */

  /** Click-on-map: add waypoint + reverse-geocode */
  private async addWaypointFromMap(lat: number, lon: number) {
    let name = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    try {
      const data: any = await this.httpGet(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&email=hugo.lembrez@gmail.com`
      );
      if (data?.address) {
        name = data.address.city || data.address.town || data.address.village
            || data.address.hamlet || name;
      }
    } catch { /* keep coord name */ }

    this.pushWaypoint({ lat, lon, name });
  }

  /** Search-box: add waypoint by city name */
  async addWaypointByCity() {
    const city = this.newCityName.trim();
    if (!city || this.addingCity) return;
    this.addingCity = true;
    this.cd.detectChanges();

    try {
      const c = await this.cityService.getLatLon(city);
      this.pushWaypoint({ lat: +c.lat, lon: +c.lon, name: city });
      this.newCityName = '';
    } catch {
      this.flashError('Ville non trouvée');
    }
    this.addingCity = false;
    this.cd.detectChanges();
  }

  removeWaypoint(i: number) {
    this.waypoints.splice(i, 1);
    this.rebuildMarkers();
    this.cd.detectChanges();
  }

  moveWaypoint(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= this.waypoints.length) return;
    [this.waypoints[i], this.waypoints[j]] = [this.waypoints[j], this.waypoints[i]];
    this.rebuildMarkers();
    this.cd.detectChanges();
  }

  /* ── internal helpers ── */

  private pushWaypoint(wp: Waypoint) {
    this.waypoints.push(wp);
    this.addMarker(wp, this.waypoints.length - 1);
    this.fitMap();
    this.cd.detectChanges();
  }

  private addMarker(wp: Waypoint, idx: number) {
    if (!this.L || !this.mapInstance) return;
    const bg = idx === 0 ? '#22c55e'
             : (idx === this.waypoints.length - 1 && this.waypoints.length > 1) ? '#ef4444'
             : '#3b82f6';
    const icon = this.L.divIcon({
      html: `<div style="background:${bg};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${idx + 1}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14], className: ''
    });
    const marker = this.L.marker([wp.lat, wp.lon], { icon, draggable: true })
      .addTo(this.mapInstance)
      .bindPopup(`<b>${wp.name}</b>`);

    marker.on('dragend', async () => {
      const p = marker.getLatLng();
      const currentIdx = this.waypointMarkers.indexOf(marker);
      if (currentIdx < 0) return;
      this.waypoints[currentIdx].lat = p.lat;
      this.waypoints[currentIdx].lon = p.lng;
      try {
        const data: any = await this.httpGet(
          `https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lng}&format=json&zoom=10&email=hugo.lembrez@gmail.com`
        );
        if (data?.address) {
          this.waypoints[currentIdx].name = data.address.city || data.address.town
              || data.address.village || data.address.hamlet
              || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
        }
      } catch {}
      this.rebuildMarkers();
      this.cd.detectChanges();
    });

    this.waypointMarkers.push(marker);
  }

  private rebuildMarkers() {
    for (const m of this.waypointMarkers) this.mapInstance?.removeLayer(m);
    this.waypointMarkers = [];
    this.waypoints.forEach((wp, i) => this.addMarker(wp, i));
    this.fitMap();
  }

  private fitMap() {
    if (!this.mapInstance || !this.L || !this.waypoints.length) return;
    if (this.waypoints.length === 1) {
      this.mapInstance.setView([this.waypoints[0].lat, this.waypoints[0].lon], 12);
    } else {
      const b = this.L.latLngBounds(this.waypoints.map((w: Waypoint) => [w.lat, w.lon]));
      this.mapInstance.fitBounds(b.pad(0.15));
    }
  }

  /* ═══════════════ Generate route ═══════════════ */

  async generateRoute() {
    const isLoop = this.waypoints.length === 1 && !!this.targetDistanceKm && this.targetDistanceKm > 0;
    if (!isLoop && this.waypoints.length < 2) return;

    this.loading = true;
    this.error = '';
    this.routePoints = [];
    this.stats = null;
    this.cd.detectChanges();

    try {
      // Build waypoints list (loop or direct)
      let routeWaypoints: { lat: number; lon: number }[];
      if (isLoop) {
        this.progressText = 'Génération de la boucle…';
        this.cd.detectChanges();
        routeWaypoints = this.buildLoopWaypoints();
      } else {
        routeWaypoints = this.waypoints;
      }

      let distanceKm: number;
      let durationSec: number;
      let elevUp = 0, elevDown = 0, elevProfile: number[] = [];

      // 1) Try BRouter first (avoids gravel & private roads)
      try {
        this.progressText = 'Calcul de l\'itinéraire (BRouter)…';
        this.cd.detectChanges();
        const br = await this.fetchBRouterRoute(routeWaypoints);
        this.routePoints = br.routePoints;
        distanceKm  = br.distanceKm;
        durationSec = br.durationSec;
        elevUp      = br.elevUp;
        elevDown    = br.elevDown;
        elevProfile = br.elevProfile;
      } catch {
        // 2) Fallback: OSRM
        this.progressText = 'Calcul de l\'itinéraire (OSRM)…';
        this.cd.detectChanges();
        const osrmProfile = this.mode === 'bike' ? 'bike' : 'foot';
        const coords = routeWaypoints.map((p: any) => `${p.lon},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coords}?overview=full&geometries=geojson&steps=true`;
        const rd = await this.httpGet(url);

        if (!rd || rd.code !== 'Ok') throw new Error('Itinéraire introuvable — rapprochez les points');
        const route = rd.routes?.[0];
        if (!route?.geometry?.coordinates) throw new Error('Aucun itinéraire trouvé');

        this.routePoints = route.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lon: c[0] }));
        distanceKm  = +(route.distance / 1000).toFixed(1);
        durationSec = route.duration;

        // Separate elevation (OSRM doesn't provide it)
        this.progressText = 'Calcul du dénivelé…';
        this.cd.detectChanges();
        try {
          const ed = await this.fetchElevationProfile(this.routePoints);
          elevUp = ed.up; elevDown = ed.down; elevProfile = ed.profile;
        } catch {
          try {
            const fb = await this.fetchElevationOpenMeteo(this.routePoints);
            elevUp = fb.up; elevDown = fb.down; elevProfile = fb.profile;
          } catch {}
        }
      }

      const h = Math.floor(durationSec / 3600);
      const m = Math.round((durationSec % 3600) / 60);

      /* ── Overpass (road analysis) ── */
      let cyclePct = -1;
      let roadTypes: RouteStats['roadTypes'] = [];
      let surfaceTypes: RouteStats['surfaceTypes'] = [];
      this.progressText = 'Analyse des voies (Overpass)…';
      this.cd.detectChanges();
      try {
        const ov = await this.queryOverpass(distanceKm);
        cyclePct  = ov.cycleLanePercent;
        roadTypes = ov.roadTypes;
        surfaceTypes = ov.surfaceTypes;
      } catch {
        roadTypes = [{ label: 'Données non disponibles', percent: 100, color: 'bg-slate-300' }];
      }

      this.stats = {
        distanceKm,
        durationText: `${h}h${String(m).padStart(2, '0')}`,
        elevationUp: elevUp,
        elevationDown: elevDown,
        elevationProfile: elevProfile,
        cycleLanePercent: cyclePct,
        roadTypes,
        surfaceTypes
      };

      this.drawRoute();
      this.loading = false;
      this.progressText = '';
      this.cd.detectChanges();

    } catch (e: any) {
      this.error = e?.message || 'Erreur lors de la génération';
      this.loading = false;
      this.progressText = '';
      this.cd.detectChanges();
    }
  }

  /* ── BRouter routing (paved roads, no gravel, no private) ── */

  private async fetchBRouterRoute(points: { lat: number; lon: number }[]): Promise<{
    routePoints: RoutePoint[]; distanceKm: number; durationSec: number;
    elevUp: number; elevDown: number; elevProfile: number[];
  }> {
    // fastbike = road cycling (avoids gravel/unpaved/private)
    // trekking = hiking/running (prefers trails, still avoids private)
    const profile = this.mode === 'bike' ? 'fastbike' : 'trekking';
    const lonlats = points.map((p: any) => `${p.lon},${p.lat}`).join('|');
    const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
    const data = await this.httpGet(url);

    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates?.length) throw new Error('BRouter: aucun itinéraire');

    const coords: number[][] = feature.geometry.coordinates;
    const routePoints = coords.map((c: number[]) => ({ lat: c[1], lon: c[0] }));

    const props = feature.properties || {};
    const distanceKm  = +((parseFloat(props['track-length'] || '0')) / 1000).toFixed(1);
    const durationSec = parseFloat(props['total-time'] || '0');
    const elevUp      = Math.round(parseFloat(props['filtered ascend'] || '0'));
    const elevDown    = Math.round(parseFloat(props['filtered descend'] || '0'));

    // Elevation profile from 3rd coordinate (altitude)
    const step = Math.max(1, Math.floor(coords.length / 80));
    const elevProfile = coords
      .filter((_: any, i: number) => i % step === 0 || i === coords.length - 1)
      .map((c: number[]) => Math.round(c[2] || 0));

    return { routePoints, distanceKm, durationSec, elevUp, elevDown, elevProfile };
  }

  /* ── Loop waypoints builder ── */

  private buildLoopWaypoints(): { lat: number; lon: number }[] {
    const origin = this.waypoints[0];
    const targetKm = this.targetDistanceKm!;

    // Approximate radius: road distance ≈ 1.3× straight-line
    const radiusKm = (targetKm / (2 * Math.PI)) * 0.55;
    const latDeg = radiusKm / 111;
    const lonDeg = radiusKm / (111 * Math.cos(origin.lat * Math.PI / 180));

    // 4 intermediate points (NE, SE, SW, NW)
    const angles = [45, 135, 225, 315];
    const intermediates = angles.map(a => {
      const rad = a * Math.PI / 180;
      return { lat: origin.lat + latDeg * Math.cos(rad), lon: origin.lon + lonDeg * Math.sin(rad) };
    });

    return [origin, ...intermediates, origin];
  }

  /* ═══════════════ Elevation — Open Elevation API ═══════════════ */

  private async fetchElevationProfile(pts: RoutePoint[]): Promise<{ up: number; down: number; profile: number[] }> {
    const step    = Math.max(1, Math.floor(pts.length / 40));
    const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    const body    = { locations: sampled.map(p => ({ latitude: p.lat, longitude: p.lon })) };
    const data    = await this.httpPostJson('https://api.open-elevation.com/api/v1/lookup', body);

    if (!data?.results?.length) return { up: 0, down: 0, profile: [] };

    const elev: number[] = data.results.map((r: any) => r.elevation);
    let up = 0, down = 0;
    for (let i = 1; i < elev.length; i++) {
      const d = elev[i] - elev[i - 1];
      if (d > 0) up += d; else down -= d;
    }
    return { up: Math.round(up), down: Math.round(down), profile: elev };
  }

  /* ─── Fallback: Open-Meteo ─── */

  private async fetchElevationOpenMeteo(pts: RoutePoint[]): Promise<{ up: number; down: number; profile: number[] }> {
    const step    = Math.max(1, Math.floor(pts.length / 20));
    const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    const lats    = sampled.map(p => p.lat).join(',');
    const lons    = sampled.map(p => p.lon).join(',');
    const data    = await this.httpGet(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`);

    if (!data?.elevation?.length) return { up: 0, down: 0, profile: [] };

    const elev: number[] = data.elevation;
    let up = 0, down = 0;
    for (let i = 1; i < elev.length; i++) {
      const d = elev[i] - elev[i - 1];
      if (d > 0) up += d; else down -= d;
    }
    return { up: Math.round(up), down: Math.round(down), profile: elev };
  }

  /* ═══════════════ Overpass ═══════════════ */

  private async queryOverpass(distKm: number)
    : Promise<{ cycleLanePercent: number; roadTypes: RouteStats['roadTypes']; surfaceTypes: RouteStats['surfaceTypes'] }> {
    // Use route points for bbox when available (more accurate, especially for loops)
    const pts = this.routePoints.length > 0 ? this.routePoints : this.waypoints;
    const lats = pts.map((p: any) => p.lat);
    const lons = pts.map((p: any) => p.lon);
    const pad  = Math.max(0.02, distKm * 0.003);
    const bbox = `${Math.min(...lats) - pad},${Math.min(...lons) - pad},${Math.max(...lats) + pad},${Math.max(...lons) + pad}`;

    const q = `[out:json][timeout:20];(way["highway"="cycleway"](${bbox});way["cycleway"](${bbox});way["bicycle"="designated"](${bbox});way["highway"="residential"](${bbox});way["highway"="tertiary"](${bbox});way["highway"="secondary"](${bbox});way["highway"="primary"](${bbox});way["highway"="trunk"](${bbox});way["highway"="path"](${bbox});way["highway"="footway"](${bbox});way["highway"="track"](${bbox}););out tags;`;

    const resp = await this.httpPost(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(q)}`
    );

    const elements = resp?.elements || [];
    const tot = elements.length;
    if (!tot) return {
      cycleLanePercent: 0,
      roadTypes: [{ label: 'Données insuffisantes', percent: 100, color: 'bg-slate-300' }],
      surfaceTypes: []
    };

    // Road types
    let cyc = 0, res = 0, main = 0;
    for (const el of elements) {
      const hw = el.tags?.highway, cw = el.tags?.cycleway, bic = el.tags?.bicycle;
      if (hw === 'cycleway' || bic === 'designated' || cw) cyc++;
      else if (hw === 'residential' || hw === 'living_street') res++;
      else main++;
    }
    const cP = Math.round(cyc / tot * 100);
    const rP = Math.round(res / tot * 100);
    const mP = Math.max(0, 100 - cP - rP);

    // Surface analysis
    const PAVED = ['asphalt','concrete','paved','paving_stones','sett','concrete:plates','concrete:lanes','metal'];
    const GRAVEL = ['gravel','fine_gravel','compacted','pebblestone'];
    const UNPAVED = ['unpaved','dirt','earth','grass','ground','mud','sand','wood','woodchips'];
    let paved = 0, gravel = 0, unpaved = 0, unknown = 0;
    for (const el of elements) {
      const s = (el.tags?.surface || '').toLowerCase();
      if (!s) { unknown++; continue; }
      if (PAVED.includes(s)) paved++;
      else if (GRAVEL.includes(s)) gravel++;
      else if (UNPAVED.includes(s)) unpaved++;
      else unknown++;
    }
    const pP = Math.round(paved / tot * 100);
    const gP = Math.round(gravel / tot * 100);
    const uP = Math.round(unpaved / tot * 100);
    const kP = Math.max(0, 100 - pP - gP - uP);

    return {
      cycleLanePercent: cP,
      roadTypes: [
        { label: 'Pistes cyclables', percent: cP, color: 'bg-green-500' },
        { label: 'Résidentielles',   percent: rP, color: 'bg-blue-400' },
        { label: 'Routes principales', percent: mP, color: 'bg-amber-400' },
      ].filter(r => r.percent > 0),
      surfaceTypes: [
        { label: 'Asphalte / Pavé', percent: pP, color: 'bg-slate-600' },
        { label: 'Gravier / Compacté', percent: gP, color: 'bg-amber-500' },
        { label: 'Non revêtu', percent: uP, color: 'bg-orange-600' },
        { label: 'Inconnu', percent: kP, color: 'bg-slate-300' },
      ].filter(r => r.percent > 0)
    };
  }

  /* ═══════════════ Draw route on map ═══════════════ */

  private drawRoute() {
    if (!this.mapInstance || !this.L) return;
    if (this.routeLayer) this.mapInstance.removeLayer(this.routeLayer);
    if (this.routePoints.length) {
      const ll = this.routePoints.map(p => [p.lat, p.lon] as [number, number]);
      this.routeLayer = this.L.polyline(ll, { color: '#7c3aed', weight: 4, opacity: .8 })
        .addTo(this.mapInstance);
      this.mapInstance.fitBounds(this.routeLayer.getBounds().pad(0.1));
    }
  }

  /* ═══════════════ GPX download ═══════════════ */

  downloadGPX() {
    if (!this.routePoints.length) return;
    const nm  = this.waypoints.map(w => w.name).join(' → ');
    const pts = this.routePoints.map(p =>
      `      <trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`
    ).join('\n');
    const wps = this.waypoints.map((w, i) =>
      `  <wpt lat="${w.lat}" lon="${w.lon}"><name>${i + 1}. ${w.name}</name></wpt>`
    ).join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TourMeteo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${nm}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wps}
  <trk>
    <name>Parcours ${this.mode === 'bike' ? 'vélo' : 'course'}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `parcours_${(this.waypoints[0]?.name || 'route').replace(/\s+/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(u);
  }

  /* ═══════════════ Template helpers ═══════════════ */

  get canGenerate(): boolean {
    if (this.waypoints.length >= 2) return true;
    return this.waypoints.length === 1 && !!this.targetDistanceKm && this.targetDistanceKm > 0;
  }

  get isLoopMode(): boolean {
    return this.waypoints.length === 1 && !!this.targetDistanceKm && this.targetDistanceKm > 0;
  }

  get elevMin(): number {
    return this.stats?.elevationProfile?.length ? Math.min(...this.stats.elevationProfile) : 0;
  }
  get elevMax(): number {
    return this.stats?.elevationProfile?.length ? Math.max(...this.stats.elevationProfile) : 0;
  }

  barH(v: number): number {
    const r = this.elevMax - this.elevMin;
    return r ? 10 + ((v - this.elevMin) / r) * 90 : 50;
  }

  get distDelta(): number | null {
    if (!this.targetDistanceKm || !this.stats) return null;
    return +(this.stats.distanceKm - this.targetDistanceKm).toFixed(1);
  }

  get elevDelta(): number | null {
    if (!this.targetElevationUp || !this.stats) return null;
    return this.stats.elevationUp - this.targetElevationUp;
  }

  /* ═══════════════ HTTP ═══════════════ */

  private httpGet(url: string): Promise<any> {
    return new Promise((res, rej) => this.http.get<any>(url).subscribe({ next: res, error: rej }));
  }

  private httpPost(url: string, body: string): Promise<any> {
    return new Promise((res, rej) => this.http.post<any>(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).subscribe({ next: res, error: rej }));
  }

  private httpPostJson(url: string, body: any): Promise<any> {
    return new Promise((res, rej) => this.http.post<any>(url, body, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({ next: res, error: rej }));
  }

  private flashError(msg: string) {
    this.error = msg;
    setTimeout(() => { this.error = ''; this.cd.detectChanges(); }, 3000);
  }
}
