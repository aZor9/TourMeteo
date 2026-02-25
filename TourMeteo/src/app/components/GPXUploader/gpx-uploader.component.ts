import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { WeatherService } from '../../service/weather.service';
import { GpxExportService } from '../../service/gpx-export.service';
import { Passage, RideScoreData } from '../../models/passage.model';
import { GpxMapComponent } from './gpx-map/gpx-map.component';
import { RideScoreComponent } from './ride-score/ride-score.component';
import { GpxSummaryBarComponent } from './gpx-summary-bar/gpx-summary-bar.component';
import { GpxResultsTableComponent } from './gpx-results-table/gpx-results-table.component';

@Component({
  selector: 'app-gpx-uploader',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HttpClientModule,
    GpxMapComponent, RideScoreComponent, GpxSummaryBarComponent, GpxResultsTableComponent
  ],
  templateUrl: './gpx-uploader.component.html'
})
export class GpxUploaderComponent {
  totalDistanceKm = 0;
  points: Array<{ lat: number; lon: number }> = [];
  avgSpeed = 20;
  departure = '';
  loading = false;
  parseMessage = '';
  passages: Passage[] = [];
  progressText = '';
  displayDate = '';
  exportMessage = '';
  durationText = '';
  departureTime = '';
  arrivalTime = '';
  cityCount = 0;
  rideScoreData: RideScoreData | null = null;

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private weatherService: WeatherService,
    private exportService: GpxExportService
  ) {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');
    this.departure = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  // ─── File handling ───

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => this.parseGpx(reader.result as string);
    reader.readAsText(input.files[0]);
  }

  // ─── GPX parsing ───

  parseGpx(xmlText: string) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const all = Array.from(doc.getElementsByTagName('*')) as Element[];
      const trkpts = all.filter(e => (e.localName || '').toLowerCase() === 'trkpt');
      this.points = trkpts.map(p => ({
        lat: parseFloat(p.getAttribute('lat') || '0'),
        lon: parseFloat(p.getAttribute('lon') || '0')
      }));
      this.parseMessage = trkpts.length > 0
        ? `Points trouvés: ${trkpts.length}`
        : 'Aucun point trkpt trouvé dans le GPX.';

      let totalMeters = 0;
      for (let i = 1; i < this.points.length; i++) {
        totalMeters += this.haversineMeters(
          this.points[i - 1].lat, this.points[i - 1].lon,
          this.points[i].lat, this.points[i].lon
        );
      }
      this.totalDistanceKm = +(totalMeters / 1000).toFixed(3);
      this.cd.detectChanges();
    } catch {
      this.points = [];
      this.totalDistanceKm = 0;
      this.parseMessage = 'Erreur lors du parsing GPX';
    }
  }

  // ─── Schedule computation ───

  async computeSchedule() {
    if (this.points.length < 2 || !this.departure) return;
    const departureDate = new Date(this.departure);
    if (isNaN(departureDate.getTime())) return;

    this.displayDate = formatDate(departureDate, 'dd/MM/yyyy', 'en-US');

    // cumulative distances
    const cumMeters: number[] = [0];
    for (let i = 1; i < this.points.length; i++) {
      cumMeters[i] = (cumMeters[i - 1] || 0) + this.haversineMeters(
        this.points[i - 1].lat, this.points[i - 1].lon,
        this.points[i].lat, this.points[i].lon
      );
    }

    // sample points by distance
    const distanceStep = 2000;
    this.loading = true;
    this.passages = [];
    this.progressText = 'Recherche des villes (échantillonnage par distance)...';

    let lastSampleMeters = -Infinity;
    const sampleIndices: number[] = [];
    for (let i = 0; i < this.points.length; i++) {
      const meters = cumMeters[i] || 0;
      if (i === 0 || meters - lastSampleMeters >= distanceStep || i === this.points.length - 1) {
        sampleIndices.push(i);
        lastSampleMeters = meters;
      }
    }

    const roundCoord = (v: number, d = 2) => Number(v.toFixed(d));
    const seenCoords = new Set<string>();
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const coordToCity = new Map<string, string>();

    for (const i of sampleIndices) {
      const { lat, lon } = this.points[i];
      const key = `${roundCoord(lat, 2)}_${roundCoord(lon, 2)}`;
      const meters = cumMeters[i] || 0;
      const hours = (meters / 1000) / (this.avgSpeed || 1);
      const time = new Date(departureDate.getTime() + Math.round(hours * 3600 * 1000));

      if (seenCoords.has(key)) {
        const city = coordToCity.get(key) || 'Inconnu';
        this.passages.push({ city, lat, lon, time, distanceKm: +(meters / 1000).toFixed(1), status: 'pending' });
      } else {
        seenCoords.add(key);
        try {
          await delay(1100);
          const city = await this.reverseGeocode(lat, lon);
          coordToCity.set(key, city);
          this.passages.push({ city, lat, lon, time, distanceKm: +(meters / 1000).toFixed(1), status: 'pending' });
        } catch (err: any) {
          coordToCity.set(key, 'Inconnu');
          this.passages.push({ city: 'Inconnu', lat, lon, time, distanceKm: +(meters / 1000).toFixed(1), status: 'error', message: err?.message || 'Reverse geocode failed' });
        }
      }
      this.progressText = `Recherche des villes... (${this.passages.length} passages échantillonnés, ${coordToCity.size} géocodages)`;
      this.cd.detectChanges();
    }

    // Filter unknown & consecutive duplicates
    const filtered: Passage[] = [];
    let lastCity: string | null = null;
    for (const p of this.passages) {
      const cityName = (p.city || '').trim();
      if (!cityName || cityName.toLowerCase() === 'inconnu') continue;
      if (lastCity && lastCity === cityName) continue;
      filtered.push(p);
      lastCity = cityName;
    }
    this.passages = filtered;

    // Fetch weather for each passage
    this.progressText = `Récupération météo pour ${this.passages.length} passages...`;
    for (let idx = 0; idx < this.passages.length; idx++) {
      const p = this.passages[idx];
      if (p.status === 'pending') {
        try {
          const dateStr = formatDate(p.time, 'yyyy-MM-dd', 'en-US');
          const weather = await this.weatherService.getWeather(p.city, dateStr);
          const targetHour = p.time.getHours();
          const found = weather.hourly.find(h => new Date(h.hour).getHours() === targetHour)
            || weather.hourly.reduce((a, b) =>
              Math.abs(new Date(a.hour).getTime() - p.time.getTime()) < Math.abs(new Date(b.hour).getTime() - p.time.getTime()) ? a : b
            );
          if (found) {
            p.weather = {
              temperature: found.temperature, code: found.summary, wind: found.wind,
              windDir: found.windDir, isDay: found.isDay, precipitation: found.precipitation,
              precipitationProbability: found.precipitationProbability,
              humidity: found.humidity, apparentTemperature: found.apparentTemperature
            };
            p.status = 'ok';
          } else {
            p.status = 'error';
            p.message = 'Aucune donnée horaire';
          }
        } catch (err: any) {
          p.status = 'error';
          p.message = (err && err.message) ? err.message : 'Erreur météo';
        }
      }
      this.progressText = `Récupération météo... ${idx + 1}/${this.passages.length}`;
      this.cd.detectChanges();
      await new Promise(res => setTimeout(res, 300));
    }

    this.loading = false;
    this.progressText = 'Terminé';

    // Compute summary stats
    this.cityCount = this.passages.length;
    if (this.passages.length > 0) {
      const dep = this.passages[0].time;
      const arr = this.passages[this.passages.length - 1].time;
      this.departureTime = `${String(dep.getHours()).padStart(2, '0')}:${String(dep.getMinutes()).padStart(2, '0')}`;
      this.arrivalTime = `${String(arr.getHours()).padStart(2, '0')}:${String(arr.getMinutes()).padStart(2, '0')}`;
      const diffMs = arr.getTime() - dep.getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.round((diffMs % 3600000) / 60000);
      this.durationText = `${diffH}h${String(diffM).padStart(2, '0')}`;
    }

    this.cd.detectChanges();
  }

  // ─── Score callback ───

  onScoreComputed(data: RideScoreData) {
    this.rideScoreData = data;
  }

  // ─── Export actions ───

  async exportAsImage() {
    this.exportMessage = 'Génération en cours...';
    this.exportMessage = await this.exportService.exportAsImage(
      this.passages, this.displayDate, this.totalDistanceKm,
      this.durationText, this.departureTime, this.arrivalTime, this.cityCount,
      this.rideScoreData
    );
  }

  async shareImage() {
    this.exportMessage = 'Génération en cours...';
    this.exportMessage = await this.exportService.shareImage(
      this.passages, this.displayDate, this.totalDistanceKm,
      this.durationText, this.departureTime, this.arrivalTime, this.cityCount,
      this.rideScoreData
    );
  }

  // ─── Helpers ───

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    return new Promise((resolve, reject) => {
      this.http.get<any>(url).subscribe({
        next: res => {
          const addr = res?.address;
          resolve(addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || 'Inconnu');
        },
        error: err => reject(err)
      });
    });
  }
}
