import { Component, ChangeDetectorRef, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EditPoint, MAX_GPX_BYTES, buildGpx, elevationGain, haversineMeters, interpolatedPoint, nearestOnPath,
  parseGpx, safeFileName, simplify, totalDistanceKm
} from '../../utils/gpx-edit';
import { RoutingProfile, distributeTimes, routeThrough } from '../../utils/routing';

type Mode = 'select' | 'box' | 'add';

/** Au-delà de ce nombre de points visibles à l'écran, on masque les poignées (illisible et lent) : il faut zoomer */
const MAX_HANDLES = 500;
const MAX_HISTORY = 50;

@Component({
  selector: 'app-gpx-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gpx-editor.component.html'
})
export class GpxEditorComponent implements OnDestroy {
  name = '';
  points: EditPoint[] = [];
  selected = new Set<number>();
  mode: Mode = 'select';
  error = '';
  info = '';
  tooManyHandles = false;
  simplifyTolerance = 5;

  /** « Suivre la route » : les points ajoutés sont reliés en suivant les routes (BRouter / OSRM) */
  snap = false;
  snapProfile: RoutingProfile = 'bike';
  snapping = false;

  /** Coupe : nombre de points retirés au début / à la fin (aperçu en rouge sur la carte) */
  cutHead = 0;
  cutTail = 0;
  private cum: number[] = [];
  private cutLayer: any = null;

  distanceKm = 0;
  gain: number | null = null;
  mergedSegments = 1;

  private history: EditPoint[][] = [];
  private future: EditPoint[][] = [];
  private original: EditPoint[] = [];

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;
  private L: any = null;
  private map: any = null;
  private line: any = null;
  private handles: any = null;
  private boxRect: any = null;
  private boxStart: { x: number; y: number } | null = null;
  private renderQueued = false;

  constructor(private cd: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this.disableBox();
    this.map?.remove();
    this.map = null;
  }

  get canUndo(): boolean { return this.history.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  // ─── Chargement ───

  async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de recharger le même fichier
    if (!file) return;
    this.error = '';
    this.info = '';
    if (file.size > MAX_GPX_BYTES) {
      this.error = 'Fichier trop volumineux (15 Mo maximum).';
      return;
    }
    try {
      const parsed = parseGpx(await file.text(), file.name.replace(/\.gpx$/i, ''));
      this.name = parsed.name;
      this.points = parsed.points;
      this.original = parsed.points.slice();
      this.mergedSegments = parsed.segments;
      this.history = [];
      this.future = [];
      this.selected.clear();
      this.mode = 'select';
      this.updateStats();
      this.cd.detectChanges(); // crée le conteneur de la carte
      await this.ensureMap();
      this.redraw(true);
    } catch (e: any) {
      this.error = e?.message || 'Impossible de lire ce fichier.';
    }
    this.cd.detectChanges();
  }

  // ─── Carte ───

  private async ensureMap(): Promise<void> {
    if (this.map) { this.map.invalidateSize(); return; }
    const mod: any = await import('leaflet');
    this.L = mod.default || mod;
    const L = this.L;
    this.map = L.map(this.mapEl!.nativeElement, { zoomControl: true, doubleClickZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.line = L.polyline([], { color: '#1B5A96', weight: 4, opacity: 0.85, smoothFactor: 1.5 }).addTo(this.map);
    this.handles = L.layerGroup().addTo(this.map);
    this.cutLayer = L.layerGroup().addTo(this.map);
    this.map.on('moveend', () => this.queueRender());
    this.map.on('click', (e: any) => { if (this.mode === 'add') void this.addPointAt(e.latlng.lat, e.latlng.lng); });
  }

  private redraw(fit = false): void {
    if (!this.map) return;
    this.line.setLatLngs(this.points.map(p => [p.lat, p.lon]));
    if (fit && this.points.length) {
      this.map.fitBounds(this.line.getBounds().pad(0.1));
    }
    this.renderHandles();
  }

  private queueRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => { this.renderQueued = false; this.renderHandles(); });
  }

  /** Poignées déplaçables, uniquement pour les points visibles à l'écran */
  private renderHandles(): void {
    if (!this.map || !this.L) return;
    const L = this.L;
    this.handles.clearLayers();
    const bounds = this.map.getBounds().pad(0.05);
    const last = this.points.length - 1;
    const visible: number[] = [];
    for (let i = 0; i <= last; i++) {
      if (bounds.contains([this.points[i].lat, this.points[i].lon])) visible.push(i);
    }
    this.tooManyHandles = visible.length > MAX_HANDLES;
    const toDraw = this.tooManyHandles ? visible.filter(i => i === 0 || i === last || this.selected.has(i)).slice(0, MAX_HANDLES) : visible;

    for (const i of toDraw) {
      const p = this.points[i];
      const sel = this.selected.has(i);
      const color = sel ? '#F97316' : i === 0 ? '#16A34A' : i === last ? '#DC2626' : '#1B5A96';
      // Poignées plus grandes au doigt (écran tactile)
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const size = (sel || i === 0 || i === last ? 18 : 14) + (coarse ? 10 : 0);
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);"></div>`
      });
      const m = L.marker([p.lat, p.lon], { icon, draggable: true, keyboard: false, title: `Point ${i + 1}` });
      m.on('click', () => this.toggle(i));
      m.on('dragend', () => {
        const ll = m.getLatLng();
        this.commit();
        this.points[i] = { ...this.points[i], lat: +ll.lat.toFixed(7), lon: +ll.lng.toFixed(7) };
        this.afterEdit();
      });
      m.addTo(this.handles);
    }
    this.cd.detectChanges();
  }

  // ─── Modes ───

  setMode(m: Mode): void {
    if (this.mode === m) m = 'select';
    this.disableBox();
    this.mode = m;
    const c = this.map?.getContainer();
    if (c) c.style.cursor = m === 'add' ? 'copy' : '';
    if (m === 'box') this.enableBox();
  }

  // Sélection par rectangle (souris et tactile : événements « pointer »)
  private onBoxDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('.leaflet-marker-icon, .leaflet-control')) return;
    const c = this.map.getContainer() as HTMLElement;
    const r = c.getBoundingClientRect();
    this.boxStart = { x: e.clientX - r.left, y: e.clientY - r.top };
    c.setPointerCapture(e.pointerId);
  };

  private onBoxMove = (e: PointerEvent): void => {
    if (!this.boxStart) return;
    const c = this.map.getContainer() as HTMLElement;
    const r = c.getBoundingClientRect();
    const b = this.boxBounds(this.boxStart, { x: e.clientX - r.left, y: e.clientY - r.top });
    if (!this.boxRect) this.boxRect = this.L.rectangle(b, { color: '#F97316', weight: 2, fillOpacity: 0.15, interactive: false }).addTo(this.map);
    else this.boxRect.setBounds(b);
  };

  private onBoxUp = (e: PointerEvent): void => {
    if (!this.boxStart) return;
    const c = this.map.getContainer() as HTMLElement;
    const r = c.getBoundingClientRect();
    const end = { x: e.clientX - r.left, y: e.clientY - r.top };
    const moved = Math.hypot(end.x - this.boxStart.x, end.y - this.boxStart.y) > 6;
    if (moved) {
      const b = this.boxBounds(this.boxStart, end);
      let n = 0;
      this.points.forEach((p, i) => { if (b.contains([p.lat, p.lon])) { this.selected.add(i); n++; } });
      this.info = n ? `${n} point${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la sélection.` : 'Aucun point dans cette zone.';
    }
    this.boxStart = null;
    if (this.boxRect) { this.boxRect.remove(); this.boxRect = null; }
    this.renderHandles();
  };

  private boxBounds(a: { x: number; y: number }, b: { x: number; y: number }): any {
    const L = this.L;
    return L.latLngBounds(this.map.containerPointToLatLng(L.point(a.x, a.y)), this.map.containerPointToLatLng(L.point(b.x, b.y)));
  }

  private enableBox(): void {
    if (!this.map) return;
    const c = this.map.getContainer() as HTMLElement;
    this.map.dragging.disable();
    c.style.cursor = 'crosshair';
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', this.onBoxDown);
    c.addEventListener('pointermove', this.onBoxMove);
    c.addEventListener('pointerup', this.onBoxUp);
  }

  private disableBox(): void {
    if (!this.map) return;
    const c = this.map.getContainer() as HTMLElement;
    c.removeEventListener('pointerdown', this.onBoxDown);
    c.removeEventListener('pointermove', this.onBoxMove);
    c.removeEventListener('pointerup', this.onBoxUp);
    c.style.touchAction = '';
    c.style.cursor = '';
    this.map.dragging.enable();
    this.boxStart = null;
    if (this.boxRect) { this.boxRect.remove(); this.boxRect = null; }
  }

  // ─── Sélection ───

  toggle(i: number): void {
    if (this.selected.has(i)) this.selected.delete(i); else this.selected.add(i);
    this.info = '';
    this.renderHandles();
  }

  clearSelection(): void {
    this.selected.clear();
    this.renderHandles();
  }

  /** Sélectionne tous les points compris entre le plus petit et le plus grand point sélectionné */
  selectBetween(): void {
    if (this.selected.size < 2) return;
    const idx = [...this.selected];
    const lo = Math.min(...idx);
    const hi = Math.max(...idx);
    for (let i = lo; i <= hi; i++) this.selected.add(i);
    this.info = `${hi - lo + 1} points sélectionnés.`;
    this.renderHandles();
  }

  // ─── Modifications (toutes annulables) ───

  private commit(): void {
    this.history.push(this.points.slice());
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.future = [];
  }

  private afterEdit(): void {
    this.selected.clear();
    this.cutHead = 0;
    this.cutTail = 0;
    this.updateStats();
    this.redraw();
    this.cutLayer?.clearLayers();
  }

  private updateStats(): void {
    this.distanceKm = totalDistanceKm(this.points);
    this.gain = elevationGain(this.points);
    // Distances cumulées (km) : sert à afficher les km retirés par la coupe
    this.cum = new Array(this.points.length);
    let acc = 0;
    this.cum[0] = 0;
    for (let i = 1; i < this.points.length; i++) {
      acc += haversineMeters(this.points[i - 1], this.points[i]) / 1000;
      this.cum[i] = acc;
    }
  }

  deleteSelected(): void {
    if (this.selected.size === 0) return;
    if (this.selected.size >= this.points.length) {
      this.error = 'Impossible de tout supprimer : il doit rester au moins un point.';
      return;
    }
    const n = this.selected.size;
    this.commit();
    this.points = this.points.filter((_, i) => !this.selected.has(i));
    this.info = `${n} point${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}.`;
    this.error = '';
    this.afterEdit();
  }

  /** Ajoute un point à l'endroit cliqué, inséré au bon endroit du tracé (ou en début / fin) */
  private async addPointAt(lat: number, lon: number): Promise<void> {
    if (this.snapping) return;
    const near = nearestOnPath(this.points, { lat, lon });
    const p: EditPoint = { lat: +lat.toFixed(7), lon: +lon.toFixed(7) };
    const n = this.points.length;
    const kind: 'first' | 'start' | 'end' | 'mid' = !near ? 'first'
      : near.segment === 0 && near.t === 0 ? 'start'
      : near.segment === n - 2 && near.t === 1 ? 'end' : 'mid';

    if (this.snap && near) {
      await this.addAlongRoad(p, kind as 'start' | 'end' | 'mid', near.segment);
      return;
    }

    this.commit();
    if (kind === 'first') {
      this.points = [...this.points, p];
    } else if (kind === 'start') {
      this.points = [{ ...p, ...(this.points[0].ele !== undefined ? { ele: this.points[0].ele } : {}) }, ...this.points];
    } else if (kind === 'end') {
      const last = this.points[n - 1];
      this.points = [...this.points, { ...p, ...(last.ele !== undefined ? { ele: last.ele } : {}) }];
    } else {
      const a = this.points[near!.segment];
      const b = this.points[near!.segment + 1];
      const np = interpolatedPoint(p.lat, p.lon, a, b, near!.t);
      this.points = [...this.points.slice(0, near!.segment + 1), np, ...this.points.slice(near!.segment + 1)];
    }
    this.info = 'Point ajouté.';
    this.afterEdit();
  }

  /** Mode « Suivre la route » : remplace la ligne droite par l'itinéraire routier passant par le point cliqué */
  private async addAlongRoad(click: EditPoint, kind: 'start' | 'end' | 'mid', seg: number): Promise<void> {
    const pts = this.points;
    const n = pts.length;
    this.snapping = true;
    this.error = '';
    this.info = 'Calcul de l\'itinéraire…';
    this.cd.detectChanges();
    try {
      const steps = kind === 'start' ? [click, pts[0]] : kind === 'end' ? [pts[n - 1], click] : [pts[seg], click, pts[seg + 1]];
      let routed = await routeThrough(steps, this.snapProfile);
      if (this.points !== pts) return; // le tracé a changé pendant le calcul (annulation, nouveau fichier…)

      let next: EditPoint[];
      let added: number;
      if (kind === 'start') {
        next = [...routed.slice(0, -1), ...pts];
        added = routed.length - 1;
      } else if (kind === 'end') {
        next = [...pts, ...routed.slice(1)];
        added = routed.length - 1;
      } else {
        routed = distributeTimes(routed, pts[seg], pts[seg + 1]);
        const inner = routed.slice(1, -1);
        next = [...pts.slice(0, seg + 1), ...inner, ...pts.slice(seg + 1)];
        added = inner.length;
      }
      this.commit();
      this.points = next;
      this.info = `Point ajouté en suivant la route (+${added} points).`;
    } catch {
      // Service indisponible ou aucune route à proximité : on ajoute le point en ligne droite
      this.commit();
      const a = pts[seg];
      const b = pts[seg + 1];
      const np = kind === 'mid' ? interpolatedPoint(click.lat, click.lon, a, b, nearestOnPath(pts, click)?.t ?? 0.5) : click;
      this.points = kind === 'start' ? [np, ...pts]
        : kind === 'end' ? [...pts, np]
        : [...pts.slice(0, seg + 1), np, ...pts.slice(seg + 1)];
      this.info = '';
      this.error = 'Itinéraire indisponible ici : le point a été ajouté en ligne droite.';
    } finally {
      this.snapping = false;
    }
    this.afterEdit();
    this.cd.detectChanges();
  }

  reverse(): void {
    this.commit();
    this.points = this.points.slice().reverse();
    this.info = 'Sens du parcours inversé.';
    this.afterEdit();
  }

  simplifyTrack(): void {
    const before = this.points.length;
    const result = simplify(this.points, this.simplifyTolerance);
    if (result.length === before) { this.info = 'Rien à simplifier avec cette tolérance.'; return; }
    this.commit();
    this.points = result;
    this.info = `Simplifié : ${before} → ${result.length} points (tolérance ${this.simplifyTolerance} m).`;
    this.afterEdit();
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.future.push(this.points);
    this.points = prev;
    this.info = 'Modification annulée.';
    this.afterEdit();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.history.push(this.points);
    this.points = next;
    this.info = 'Modification rétablie.';
    this.afterEdit();
  }

  resetAll(): void {
    if (this.points === this.original) return;
    this.commit();
    this.points = this.original.slice();
    this.info = 'Tracé d\'origine rétabli.';
    this.afterEdit();
    this.redraw(true);
  }

  // ─── Coupe début / fin (pratique pour les gros fichiers, au doigt) ───

  get maxCut(): number { return Math.max(0, this.points.length - 2); }
  get keptPoints(): number { return this.points.length - this.cutHead - this.cutTail; }
  get headKm(): number { return this.cutHead > 0 ? this.cum[this.cutHead] : 0; }
  get tailKm(): number { return this.cutTail > 0 ? this.cum[this.points.length - 1] - this.cum[this.points.length - 1 - this.cutTail] : 0; }
  get keptKm(): number { return Math.max(0, this.distanceKm - this.headKm - this.tailKm); }

  /** Appelé à chaque saisie / mouvement de curseur */
  onCutInput(pan?: 'head' | 'tail'): void {
    const n = this.points.length;
    let head = Math.floor(Number(this.cutHead) || 0);
    let tail = Math.floor(Number(this.cutTail) || 0);
    head = Math.max(0, Math.min(head, this.maxCut));
    tail = Math.max(0, Math.min(tail, this.maxCut - head));
    this.cutHead = head;
    this.cutTail = tail;
    this.drawCutPreview();
    if (pan && this.map) {
      const p = pan === 'head' ? this.points[head] : this.points[n - 1 - tail];
      this.map.panTo([p.lat, p.lon]);
    }
  }

  private drawCutPreview(): void {
    if (!this.cutLayer || !this.L) return;
    const L = this.L;
    const n = this.points.length;
    this.cutLayer.clearLayers();
    const style = { color: '#DC2626', weight: 5, opacity: 0.9, dashArray: '8 8', interactive: false };
    const mark = (p: EditPoint) => L.circleMarker([p.lat, p.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#F97316', fillOpacity: 1, interactive: false }).addTo(this.cutLayer);
    if (this.cutHead > 0) {
      L.polyline(this.points.slice(0, this.cutHead + 1).map(p => [p.lat, p.lon]), style).addTo(this.cutLayer);
      mark(this.points[this.cutHead]);
    }
    if (this.cutTail > 0) {
      L.polyline(this.points.slice(n - 1 - this.cutTail).map(p => [p.lat, p.lon]), style).addTo(this.cutLayer);
      mark(this.points[n - 1 - this.cutTail]);
    }
  }

  applyCut(): void {
    if (this.cutHead === 0 && this.cutTail === 0) return;
    const n = this.points.length;
    const removed = this.cutHead + this.cutTail;
    this.commit();
    this.points = this.points.slice(this.cutHead, n - this.cutTail);
    this.info = `${removed} points retirés (${(this.headKm + this.tailKm).toFixed(1)} km).`;
    this.error = '';
    this.afterEdit();
    this.redraw(true);
    this.cutLayer?.clearLayers();
  }

  cancelCut(): void {
    this.cutHead = 0;
    this.cutTail = 0;
    this.cutLayer?.clearLayers();
  }

  // ─── Export ───

  exportGpx(): void {
    if (this.points.length < 2) { this.error = 'Il faut au moins 2 points pour exporter un parcours.'; return; }
    const blob = new Blob([buildGpx(this.name, this.points)], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(this.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.info = `Exporté : ${a.download}`;
  }

  // ─── Raccourcis clavier ───

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (!this.points.length) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
    else if (e.key === 'Escape') this.clearSelection();
    else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
    else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
  }
}
