import { Component, ChangeDetectorRef, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { Chart as ChartJS, ChartConfiguration, Plugin } from 'chart.js';
import { WeatherService, DayDetails, DayHour, AirQuality, WEATHER_MODELS, DEFAULT_MODELS } from '../../service/weather.service';
import { FeatureFlagService } from '../../service/feature-flag.service';
import { CityService } from '../../service/city.service';
import { RainRadarComponent } from '../RainRadar/rain-radar.component';
import { RecentCitiesService } from '../../service/recent-cities.service';
import { getWeatherDescription, degreesToCardinal } from '../../utils/weather-utils';

interface ChartDef {
  id: 'rain' | 'temp' | 'wind' | 'sky' | 'air' | 'aqi' | 'pollen';
  title: string;
  height: string;
}

interface Tile { icon: string; label: string; value: string; sub?: string; }

/** Couleurs alignées sur la charte (styles.scss) */
const COLORS = {
  blue: '#1B5A96',
  rain: '#3B8BD4',
  rainSoft: 'rgba(59, 139, 212, 0.75)',
  temp: '#D9731A',
  beige: '#B8935A',
  green: '#4C9A6A',
  violet: '#8A5CC2',
  grid: 'rgba(28, 25, 23, 0.08)',
  text: '#72675C'
};

/** Une couleur par modèle pour les superposer sans ambiguïté */
const MODEL_COLORS: Record<string, string> = {
  best_match: COLORS.blue,
  meteofrance_seamless: COLORS.temp,
  icon_seamless: COLORS.green,
  ecmwf_ifs025: COLORS.violet,
  gfs_seamless: COLORS.beige
};

const PREFS_KEY = 'tourmeteo_hourly_prefs';
interface HourlyPrefs { models: string[]; hidden: string[]; }

function loadPrefs(): HourlyPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    const models = Array.isArray(p.models) ? p.models.filter((m: unknown) => WEATHER_MODELS.some(w => w.id === m)) : [];
    const hidden = Array.isArray(p.hidden) ? p.hidden.filter((h: unknown) => typeof h === 'string') : [];
    return { models: models.length ? models : [...DEFAULT_MODELS], hidden };
  } catch {
    return { models: [...DEFAULT_MODELS], hidden: [] };
  }
}

const AQI_LEVELS = [
  { max: 20, label: 'Bon', color: '#4C9A6A' },
  { max: 40, label: 'Correct', color: '#9BBE4A' },
  { max: 60, label: 'Moyen', color: '#E3B13A' },
  { max: 80, label: 'Médiocre', color: '#E07B39' },
  { max: 100, label: 'Mauvais', color: '#C94B4B' },
  { max: Infinity, label: 'Très mauvais', color: '#8E2D5B' }
];
const aqiLevel = (v: number) => AQI_LEVELS.find(l => v <= l.max)!;

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uvLabel(uv: number): string {
  if (uv < 3) return 'Faible';
  if (uv < 6) return 'Modéré';
  if (uv < 8) return 'Élevé';
  if (uv < 11) return 'Très élevé';
  return 'Extrême';
}

@Component({
  selector: 'app-hourly',
  standalone: true,
  imports: [CommonModule, FormsModule, RainRadarComponent],
  templateUrl: './hourly.component.html'
})
export class HourlyComponent implements OnInit, OnDestroy {
  city = '';
  date = toIsoDate(new Date());
  loading = false;
  error = '';
  geoLoading = false;

  day: DayDetails | null = null;
  air: AirQuality | null = null;
  place = '';
  tiles: Tile[] = [];
  rainText = '';
  chartDefs: ChartDef[] = [];

  /** Préférences d'affichage (mémorisées sur l'appareil) */
  readonly models = WEATHER_MODELS;
  readonly modelColors = MODEL_COLORS;
  /** Position du lieu affiché (centre du radar) */
  coords: { lat: number; lon: number } | null = null;
  selectedModels: string[];
  hiddenCharts: Set<string>;

  citySuggestions: string[] = [];
  showSuggestions = false;

  getWeatherDescription = getWeatherDescription;
  degreesToCardinal = degreesToCardinal;

  @ViewChild('strip') stripEl?: ElementRef<HTMLElement>;
  @ViewChildren('chartCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  private charts: ChartJS[] = [];
  /** Coordonnées si la source est « Ma position » (évite le géocodage) */
  private geo: { lat: number; lon: number } | null = null;
  /** Identifiant de la dernière requête : une réponse plus ancienne est ignorée */
  private reqId = 0;
  private dateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private weather: WeatherService,
    private cities: CityService,
    private recent: RecentCitiesService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
    private flags: FeatureFlagService
  ) {
    const prefs = loadPrefs();
    this.selectedModels = prefs.models;
    this.hiddenCharts = new Set(prefs.hidden);
  }

  get modelsEnabled(): boolean { return this.flags.isEnabled('hourlyModels'); }

  /** Modèles réellement demandés : le choix automatique si la fonction est désactivée */
  private get activeModels(): string[] { return this.modelsEnabled ? this.selectedModels : DEFAULT_MODELS; }

  /** Graphiques affichés (disponibles et non masqués par l'utilisateur) */
  get shownDefs(): ChartDef[] { return this.chartDefs.filter(c => !this.hiddenCharts.has(c.id)); }

  isModelSelected(id: string): boolean { return this.selectedModels.includes(id); }

  /** Ajoute/retire un modèle (au moins un reste toujours sélectionné) puis recharge */
  toggleModel(id: string): void {
    const on = this.isModelSelected(id);
    if (on && this.selectedModels.length === 1) return;
    // Ordre du catalogue : le premier modèle coché sert de référence aux tuiles et au bandeau
    this.selectedModels = WEATHER_MODELS.map(m => m.id).filter(m => m === id ? !on : this.isModelSelected(m));
    this.savePrefs();
    if (this.city.trim()) void this.load();
  }

  isChartShown(id: string): boolean { return !this.hiddenCharts.has(id); }

  async toggleChart(id: string): Promise<void> {
    if (this.hiddenCharts.has(id)) this.hiddenCharts.delete(id); else this.hiddenCharts.add(id);
    this.savePrefs();
    if (!this.day) return;
    this.cd.detectChanges(); // crée/retire les <canvas> avant de redessiner
    await this.drawCharts(this.reqId);
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ models: this.selectedModels, hidden: [...this.hiddenCharts] }));
    } catch { /* stockage indisponible : préférences non mémorisées */ }
  }

  ngOnInit(): void {
    // Lien partageable : /hourly?city=Lille&date=2026-10-06
    const qp = this.route.snapshot.queryParamMap;
    const city = qp.get('city');
    const date = qp.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.date = date;
    if (city) {
      this.city = city.slice(0, 100);
      void this.load();
    }
  }

  ngOnDestroy(): void {
    if (this.dateTimer) clearTimeout(this.dateTimer);
    this.reqId++; // invalide toute requête en cours
    this.destroyCharts();
  }

  // ─── Lieux récents (même comportement que la page Daily) ───

  onCityInput(): void {
    this.geo = null;
    this.citySuggestions = this.recent.search(this.city.trim());
    this.showSuggestions = this.citySuggestions.length > 0;
  }

  onCityFocus(): void {
    this.citySuggestions = this.recent.getAll();
    this.showSuggestions = this.citySuggestions.length > 0;
  }

  onCityBlur(): void {
    // Laisse le temps de cliquer sur une suggestion
    setTimeout(() => { this.showSuggestions = false; this.cd.detectChanges(); }, 200);
  }

  pickSuggestion(city: string): void {
    this.city = city;
    this.geo = null;
    this.showSuggestions = false;
    void this.load();
  }

  removeSuggestion(city: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.recent.remove(city);
    this.citySuggestions = this.recent.search(this.city.trim());
    this.showSuggestions = this.citySuggestions.length > 0;
  }

  // ─── Navigation de date ───

  shiftDay(delta: number): void {
    const d = new Date(this.date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    this.date = toIsoDate(d);
    this.scheduleLoad();
  }

  onDateChange(): void {
    this.scheduleLoad();
  }

  /** Regroupe les changements rapprochés (clics répétés sur ‹ ›, saisie au clavier) */
  private scheduleLoad(): void {
    if (this.dateTimer) clearTimeout(this.dateTimer);
    if (!this.city.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) return;
    this.dateTimer = setTimeout(() => void this.load(), 250);
  }

  // ─── Chargement ───

  async load(): Promise<void> {
    const name = this.city.trim();
    if (!name) return;
    const id = ++this.reqId;
    this.loading = true;
    this.error = '';
    this.showSuggestions = false;
    this.cd.detectChanges();

    try {
      let lat: number, lon: number;
      if (this.geo) {
        ({ lat, lon } = this.geo);
      } else {
        const g = await this.cities.getLatLon(name);
        lat = +g.lat; lon = +g.lon;
      }
      const [day, air] = await Promise.all([
        this.weather.getDayDetails(lat, lon, this.date, this.activeModels),
        this.weather.getAirQuality(lat, lon, this.date)
      ]);
      if (id !== this.reqId) return; // réponse périmée

      if (!this.geo) this.recent.add(name);
      this.place = name;
      this.coords = { lat, lon };
      this.day = day;
      this.air = air && air.aqi.some(v => v !== null) ? air : null;
      this.buildTiles();
      this.chartDefs = this.buildChartDefs();
      this.loading = false;
      this.cd.detectChanges(); // crée les <canvas> avant de dessiner
      this.scrollStripToNow();
      await this.drawCharts(id);
      this.router.navigate([], { queryParams: this.geo ? {} : { city: name, date: this.date }, replaceUrl: true });
    } catch {
      if (id !== this.reqId) return;
      this.error = 'Impossible de récupérer la météo (lieu introuvable, date hors de portée ou service indisponible).';
      this.day = null;
      this.destroyCharts();
    } finally {
      if (id === this.reqId) {
        this.loading = false;
        this.cd.detectChanges();
      }
    }
  }

  /** Météo à la position de l'appareil (pratique sur mobile) */
  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.error = 'La géolocalisation n\'est pas disponible sur cet appareil.';
      return;
    }
    this.geoLoading = true;
    this.error = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.geoLoading = false;
        this.geo = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) };
        this.city = 'Ma position';
        void this.load();
      },
      () => {
        this.geoLoading = false;
        this.error = 'Position refusée ou indisponible.';
        this.cd.detectChanges();
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  // ─── Données dérivées ───

  trackById = (_: number, c: ChartDef) => c.id;

  get hours(): DayHour[] { return this.day?.hours ?? []; }

  private scrollStripToNow(): void {
    const el = this.stripEl?.nativeElement;
    if (!el) return;
    const today = toIsoDate(new Date()) === this.date;
    el.scrollLeft = today ? Math.max(0, (new Date().getHours() - 1) * 60) : 0;
  }

  hourLabel(h: DayHour | number): string {
    return `${typeof h === 'number' ? h : h.hour}h`;
  }

  private timeOf(iso: string | null): string {
    return iso ? iso.slice(11, 16) : '–';
  }

  private buildTiles(): void {
    const h = this.hours;
    if (!this.day || !h.length) { this.tiles = []; return; }

    const max = (xs: Array<number | null>) => Math.max(...xs.filter((x): x is number => x !== null));
    const min = (xs: Array<number | null>) => Math.min(...xs.filter((x): x is number => x !== null));
    const tiles: Tile[] = [];

    tiles.push({ icon: '🌡️', label: 'Température', value: `${Math.round(min(h.map(x => x.temperature)))}° / ${Math.round(max(h.map(x => x.temperature)))}°`, sub: `ressenti ${Math.round(min(h.map(x => x.apparent)))}° / ${Math.round(max(h.map(x => x.apparent)))}°` });

    const rainTotal = +h.reduce((s, x) => s + x.precipitation, 0).toFixed(1);
    const probMax = max(h.map(x => x.probability));
    tiles.push({ icon: '🌧️', label: 'Cumul de pluie', value: `${rainTotal} mm`, sub: isFinite(probMax) ? `proba max ${probMax} %` : undefined });

    const gust = max(h.map(x => x.gust));
    tiles.push({ icon: '💨', label: 'Vent max', value: `${Math.round(max(h.map(x => x.wind)))} km/h`, sub: isFinite(gust) ? `rafales ${Math.round(gust)} km/h` : undefined });

    const uvMax = this.day.uvMax ?? max(h.map(x => x.uv));
    if (isFinite(uvMax)) tiles.push({ icon: '🕶️', label: 'Indice UV max', value: `${uvMax}`, sub: uvLabel(uvMax) });

    if (this.day.sunrise && this.day.sunset) {
      tiles.push({ icon: '🌅', label: 'Soleil', value: `${this.timeOf(this.day.sunrise)} → ${this.timeOf(this.day.sunset)}`, sub: this.day.sunshineH != null ? `${this.day.sunshineH} h d'ensoleillement` : undefined });
    }

    const vis = min(h.map(x => x.visibilityKm));
    if (isFinite(vis)) tiles.push({ icon: '👁️', label: 'Visibilité min', value: `${vis} km` });

    const pres = h.map(x => x.pressure).filter((x): x is number => x !== null);
    if (pres.length) {
      const trend = pres[pres.length - 1] - pres[0];
      tiles.push({ icon: '🧭', label: 'Pression', value: `${Math.round(pres[0])} hPa`, sub: trend > 2 ? '↗ en hausse' : trend < -2 ? '↘ en baisse' : '→ stable' });
    }

    if (this.air) {
      const aqiMax = max(this.air.aqi);
      if (isFinite(aqiMax)) tiles.push({ icon: '🫁', label: 'Qualité de l\'air', value: aqiLevel(aqiMax).label, sub: `indice européen max ${Math.round(aqiMax)}` });
      const pollens = Object.entries(this.air.pollen)
        .map(([name, vals]) => ({ name, peak: max(vals) }))
        .filter(p => isFinite(p.peak) && p.peak >= 1)
        .sort((a, b) => b.peak - a.peak);
      if (Object.keys(this.air.pollen).length) {
        tiles.push({ icon: '🌼', label: 'Pollens', value: pollens.length ? pollens[0].name : 'Faibles', sub: pollens.length ? `pic ${Math.round(pollens[0].peak)} grains/m³` : 'rien de notable' });
      }
    }
    this.tiles = tiles;

    const rainy = h.filter(x => x.precipitation >= 0.1);
    this.rainText = rainy.length === 0
      ? 'Aucune pluie attendue 🎉'
      : rainy.length === 1
        ? `Pluie vers ${this.hourLabel(rainy[0])}`
        : `Pluie entre ${this.hourLabel(rainy[0])} et ${this.hourLabel(rainy[rainy.length - 1])}`;
  }

  private buildChartDefs(): ChartDef[] {
    const defs: ChartDef[] = [
      { id: 'rain', title: '🌧️ Précipitations', height: 'h-60 sm:h-72' },
      { id: 'temp', title: '🌡️ Température, ressenti et point de rosée', height: 'h-56 sm:h-64' },
      { id: 'wind', title: '💨 Vent et rafales', height: 'h-56 sm:h-64' },
      { id: 'sky', title: '☁️ Nuages et indice UV', height: 'h-56 sm:h-64' },
      { id: 'air', title: '💧 Humidité et pression', height: 'h-56 sm:h-64' }
    ];
    if (this.air) {
      defs.push({ id: 'aqi', title: '🫁 Qualité de l\'air', height: 'h-56 sm:h-64' });
      if (Object.keys(this.air.pollen).length) defs.push({ id: 'pollen', title: '🌼 Pollens', height: 'h-56 sm:h-64' });
    }
    return defs;
  }

  // ─── Graphiques (Chart.js chargé à la demande) ───

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private async drawCharts(id: number): Promise<void> {
    if (!this.day) return;
    const {
      Chart, BarController, LineController, BarElement, LineElement, PointElement,
      CategoryScale, LinearScale, Tooltip, Legend, Filler
    } = await import('chart.js');
    if (id !== this.reqId) return;
    Chart.register(BarController, LineController, BarElement, LineElement, PointElement,
      CategoryScale, LinearScale, Tooltip, Legend, Filler);
    Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
    Chart.defaults.color = COLORS.text;
    Chart.defaults.animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 500 };

    this.destroyCharts();
    const h = this.hours;
    const labels = h.map(x => this.hourLabel(x));
    const today = toIsoDate(new Date()) === this.date;
    const nowHour = new Date().getHours();

    /** Fond bleuté la nuit + ligne verticale « maintenant » si la date est aujourd'hui */
    const decor: Plugin = {
      id: 'decor',
      beforeDatasetsDraw: chart => {
        const { ctx, chartArea, scales } = chart;
        const x = scales['x'];
        if (!chartArea || !x || h.length < 2) return;
        const step = x.getPixelForValue(1) - x.getPixelForValue(0);
        ctx.save();
        ctx.fillStyle = 'rgba(27, 90, 150, 0.06)';
        h.forEach((hr, i) => {
          if (hr.isDay) return;
          const c = x.getPixelForValue(i);
          const left = Math.max(chartArea.left, c - step / 2);
          const right = Math.min(chartArea.right, c + step / 2);
          ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
        });
        if (today) {
          const nx = x.getPixelForValue(Math.min(nowHour, h.length - 1));
          ctx.strokeStyle = COLORS.beige;
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(nx, chartArea.top);
          ctx.lineTo(nx, chartArea.bottom);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const base = (unit: string): NonNullable<ChartConfiguration['options']> => ({
      responsive: true,
      maintainAspectRatio: false,
      // Tooltip sur toute la colonne horaire : pratique au doigt
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y} ${unit}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0 } },
        y: { grid: { color: COLORS.grid }, beginAtZero: true }
      }
    });
    const axis = (text: string, extra: object = {}) => ({ grid: { color: COLORS.grid }, title: { display: true, text }, ...extra });
    const rightAxis = (text: string, extra: object = {}) => ({ position: 'right' as const, grid: { drawOnChartArea: false }, title: { display: true, text }, ...extra });
    const line = (label: string, data: Array<number | null>, color: string, extra: object = {}) => ({
      type: 'line' as const, label, data, borderColor: color, backgroundColor: color, borderWidth: 2.5,
      pointRadius: 0, pointHoverRadius: 5, tension: 0.35, spanGaps: true, ...extra
    });
    const dashed = { borderDash: [5, 4], borderWidth: 2 };
    const perAxis = (units: Record<string, string>): NonNullable<ChartConfiguration['options']>['plugins'] => ({
      legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y} ${units[ctx.dataset.yAxisID ?? 'y'] ?? ''}` } }
    });

    // Mode comparaison : plusieurs modèles superposés, une couleur par modèle
    const byModel = this.day.byModel ?? {};
    const compared = Object.keys(byModel);
    const compare = compared.length > 1;
    const modelLabel = (m: string) => WEATHER_MODELS.find(w => w.id === m)?.label ?? m;
    const perModel = (pick: (x: DayHour) => number | null, extra: object = {}) =>
      compared.map(m => line(modelLabel(m), byModel[m].map(pick), MODEL_COLORS[m] ?? COLORS.blue, extra));

    const build = (def: ChartDef): ChartConfiguration | null => {
      switch (def.id) {
        case 'rain': {
          const o = base('mm');
          if (compare) {
            // Tous les modèles ne fournissent pas de probabilité : on la déduit du vote
            // (part des modèles qui prévoient au moins 0,1 mm sur l'heure)
            o.scales = { x: o.scales!['x'], y: axis('mm', { beginAtZero: true, suggestedMax: 2 }), y1: rightAxis('% des modèles', { min: 0, max: 100 }) };
            o.plugins = perAxis({ y: 'mm', y1: '%' });
            const vote = labels.map((_, i) => Math.round(100 * compared.filter(m => (byModel[m][i]?.precipitation ?? 0) >= 0.1).length / compared.length));
            return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: [
              ...perModel(x => x.precipitation, { tension: 0, stepped: 'middle', yAxisID: 'y' }),
              { type: 'bar', label: 'Accord pluie (vote)', data: vote, backgroundColor: 'rgba(59, 139, 212, 0.18)', borderRadius: 3, yAxisID: 'y1', order: 9 }
            ] as any } };
          }
          const hasProb = h.some(x => x.probability !== null);
          o.scales = { x: o.scales!['x'], y: axis('mm', { beginAtZero: true, suggestedMax: 2 }), y1: rightAxis('%', { min: 0, max: 100 }) };
          o.plugins = perAxis({ y: 'mm', y1: '%' });
          const ds: any[] = [{ type: 'bar', label: 'Pluie', data: h.map(x => x.precipitation), backgroundColor: COLORS.rainSoft, borderRadius: 4, yAxisID: 'y', order: 2 }];
          if (hasProb) ds.push(line('Probabilité', h.map(x => x.probability), COLORS.beige, { ...dashed, yAxisID: 'y1', order: 1 }));
          return { type: 'bar', options: o, plugins: [decor], data: { labels, datasets: ds } };
        }
        case 'temp': {
          const o = base('°C');
          o.scales!['y'] = axis('°C', { beginAtZero: false });
          if (compare) return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: perModel(x => x.temperature) as any } };
          const ds: any[] = [
            line('Température', h.map(x => x.temperature), COLORS.temp, { fill: true, backgroundColor: 'rgba(217, 115, 26, 0.12)' }),
            line('Ressenti', h.map(x => x.apparent), COLORS.beige, dashed)
          ];
          if (h.some(x => x.dewPoint !== null)) ds.push(line('Point de rosée', h.map(x => x.dewPoint), COLORS.rain, { borderDash: [2, 3], borderWidth: 1.5 }));
          return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: ds } };
        }
        case 'wind': {
          const o = base('km/h');
          o.scales!['y'] = axis('km/h', { beginAtZero: true });
          if (compare) return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: perModel(x => x.wind) as any } };
          // Direction dans l'infobulle : "Vent : 18 km/h (SW)"
          o.plugins!.tooltip = { callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` Vent : ${ctx.parsed.y} km/h ${h[ctx.dataIndex].windDir != null ? '(' + degreesToCardinal(h[ctx.dataIndex].windDir).replace(/^\d+° /, '') + ')' : ''}`
              : ` ${ctx.dataset.label} : ${ctx.parsed.y} km/h`
          } };
          const ds: any[] = [line('Vent', h.map(x => x.wind), COLORS.blue, { fill: true, backgroundColor: 'rgba(27, 90, 150, 0.12)' })];
          if (h.some(x => x.gust !== null)) ds.push(line('Rafales', h.map(x => x.gust), COLORS.violet, dashed));
          return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: ds } };
        }
        case 'sky': {
          const o = base('%');
          o.scales = { x: o.scales!['x'], y: axis('% nuages', { min: 0, max: 100 }), y1: rightAxis('UV', { min: 0, suggestedMax: 6 }) };
          o.plugins = perAxis({ y: '%', y1: '' });
          return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: [
            line('Couverture nuageuse', h.map(x => x.cloud), '#8DA4BC', { fill: true, backgroundColor: 'rgba(141, 164, 188, 0.25)', yAxisID: 'y' }),
            { type: 'bar', label: 'Indice UV', data: h.map(x => x.uv), backgroundColor: 'rgba(227, 177, 58, 0.7)', borderRadius: 3, yAxisID: 'y1' }
          ] as any } };
        }
        case 'air': {
          const o = base('%');
          o.scales = { x: o.scales!['x'], y: axis('% humidité', { min: 0, max: 100 }), y1: rightAxis('hPa', { beginAtZero: false }) };
          o.plugins = perAxis({ y: '%', y1: 'hPa' });
          return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: [
            line('Humidité', h.map(x => x.humidity), COLORS.rain, { yAxisID: 'y' }),
            line('Pression', h.map(x => x.pressure), COLORS.green, { ...dashed, yAxisID: 'y1' })
          ] } };
        }
        case 'aqi': {
          const a = this.air!;
          const o = base('');
          o.scales = { x: o.scales!['x'], y: axis('indice', { beginAtZero: true }), y1: rightAxis('µg/m³', { beginAtZero: true }) };
          o.plugins = perAxis({ y: '', y1: 'µg/m³' });
          return { type: 'bar', options: o, plugins: [decor], data: { labels, datasets: [
            { type: 'bar', label: 'Indice européen', data: a.aqi, backgroundColor: a.aqi.map(v => v === null ? 'transparent' : aqiLevel(v).color), borderRadius: 3, yAxisID: 'y', order: 2 },
            line('PM2.5', a.pm25, COLORS.violet, { yAxisID: 'y1', order: 1, borderWidth: 2 }),
            line('PM10', a.pm10, COLORS.beige, { yAxisID: 'y1', order: 1, borderWidth: 2, ...{ borderDash: [5, 4] } })
          ] as any } };
        }
        case 'pollen': {
          const palette = [COLORS.green, COLORS.violet, COLORS.temp, COLORS.blue, COLORS.beige, COLORS.rain];
          const o = base('grains/m³');
          o.scales!['y'] = axis('grains/m³', { beginAtZero: true });
          const ds = Object.entries(this.air!.pollen).map(([name, vals], i) => line(name, vals, palette[i % palette.length], { borderWidth: 2 }));
          return { type: 'line', options: o, plugins: [decor], data: { labels, datasets: ds } };
        }
      }
    };

    for (const el of this.canvases.toArray()) {
      const canvas = el.nativeElement;
      const def = this.chartDefs.find(d => d.id === canvas.dataset['id']);
      const cfg = def && build(def);
      if (cfg) this.charts.push(new Chart(canvas, cfg));
    }
  }
}
