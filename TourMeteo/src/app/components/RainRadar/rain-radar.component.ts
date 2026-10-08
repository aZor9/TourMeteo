import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface RadarFrame { time: number; path: string; }

/** Radar de précipitations observé (RainViewer) : ~2 h passées, animé */
@Component({
  selector: 'app-rain-radar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl overflow-hidden border" style="border-color:#DDD4C0;">
      <div #mapContainer style="height: 320px; width: 100%; z-index: 0;"></div>
    </div>
    <div *ngIf="error" class="text-xs mt-2" style="color:#C94B4B;">{{ error }}</div>
    <div *ngIf="frames.length" class="flex items-center gap-2 mt-2">
      <button type="button" (click)="togglePlay()" class="btn btn-ghost btn-sm min-w-[44px]" [attr.aria-label]="playing ? 'Pause' : 'Lecture'">{{ playing ? '⏸' : '▶' }}</button>
      <input type="range" min="0" [max]="frames.length - 1" [value]="index" (input)="seek($any($event.target).value)"
             class="flex-1" aria-label="Instant du radar" />
      <span class="text-xs tabular-nums w-12 text-right" style="color:#72675C;">{{ timeLabel }}</span>
    </div>
  `
})
export class RainRadarComponent implements OnChanges, OnDestroy {
  @Input() lat: number | null = null;
  @Input() lon: number | null = null;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLElement>;

  frames: RadarFrame[] = [];
  index = 0;
  playing = false;
  error = '';
  timeLabel = '';

  private L: any;
  private map: any = null;
  private marker: any = null;
  private layers: any[] = [];
  private host = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['lat'] || changes['lon']) && this.lat !== null && this.lon !== null) void this.render();
  }

  ngOnDestroy(): void {
    this.stop();
    this.seq++;
    this.map?.remove();
    this.map = null;
  }

  private async render(): Promise<void> {
    const id = ++this.seq;
    this.error = '';
    this.L = this.L ?? ((await import('leaflet')).default ?? await import('leaflet'));
    if (id !== this.seq) return;
    const L = this.L;

    if (!this.map) {
      this.map = L.map(this.mapContainer.nativeElement, { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Radar : <a href="https://www.rainviewer.com/">RainViewer</a>'
      }).addTo(this.map);
    }
    this.map.setView([this.lat, this.lon], 7);
    this.marker?.remove();
    this.marker = L.circleMarker([this.lat, this.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#1B5A96', fillOpacity: 1 }).addTo(this.map);

    if (this.frames.length) return; // images déjà chargées pour cette session
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (id !== this.seq) return;
      this.host = json.host;
      this.frames = [...(json.radar?.past ?? []), ...(json.radar?.nowcast ?? [])];
      if (!this.frames.length) throw new Error('empty');

      // Une couche par image, empilées et invisibles sauf l'image courante
      // (les tuiles ne dépassent pas le zoom 7 : au-delà elles sont agrandies)
      this.layers = this.frames.map(f => L.tileLayer(`${this.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
        opacity: 0, maxNativeZoom: 7, maxZoom: 10, zIndex: 5
      }).addTo(this.map));
      this.index = this.frames.length - 1;
      this.show(this.index);
    } catch {
      this.error = 'Radar indisponible pour le moment.';
    }
  }

  private show(i: number): void {
    this.layers.forEach((l, k) => l.setOpacity(k === i ? 0.7 : 0));
    this.index = i;
    const t = new Date(this.frames[i].time * 1000);
    this.timeLabel = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  }

  seek(v: string | number): void {
    this.stop();
    this.show(+v);
  }

  togglePlay(): void {
    if (this.playing) { this.stop(); return; }
    this.playing = true;
    if (this.index >= this.frames.length - 1) this.show(0);
    this.timer = setInterval(() => {
      if (this.index >= this.frames.length - 1) { this.stop(); return; }
      this.show(this.index + 1);
    }, 600);
  }

  private stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
