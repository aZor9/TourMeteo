import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { WeatherService } from '../../service/weather.service';
import { WeatherSheetComponent } from '../WeatherSheet/weather-sheet.component';
import { formatDate } from '@angular/common';

@Component({
  selector: 'app-gpx-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './gpx-uploader.component.html'
})
export class GpxUploaderComponent {
  totalDistanceKm = 0;
  points: Array<{ lat: number; lon: number }> = [];
  avgSpeed = 20; // km/h
  departure = ''; // datetime-local string
  cityPassages: Array<{ city: string; time: string }> = [];
  loading = false;
  parseMessage = '';
  passages: Array<{
    city: string;
    lat: number;
    lon: number;
    time: Date;
    status: 'pending' | 'ok' | 'error';
    message?: string;
    weather?: { temperature?: number; code?: number; wind?: number; windDir?: number };
  }> = [];
  progressText = '';
  displayDate = '';

  constructor(private http: HttpClient, private cd: ChangeDetectorRef, private weatherService: WeatherService) {
    // default departure: today at 09:00
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');
    this.departure = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      console.log('GPX file read, size:', text?.length || 0);
      this.parseGpx(text);
    };
    reader.readAsText(file);
  }

  parseGpx(xmlText: string) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      // robustly find trkpt elements even with namespaces
      const all = Array.from(doc.getElementsByTagName('*')) as Element[];
      const trkpts = all.filter(e => (e.localName || '').toLowerCase() === 'trkpt');
      this.points = trkpts.map(p => ({
        lat: parseFloat(p.getAttribute('lat') || '0'),
        lon: parseFloat(p.getAttribute('lon') || '0')
      }));

      this.parseMessage = trkpts.length > 0 ? `Points trouvés: ${trkpts.length}` : 'Aucun point trkpt trouvé dans le GPX.';

      // compute total distance
      let totalMeters = 0;
      for (let i = 1; i < this.points.length; i++) {
        totalMeters += this.haversineMeters(
          this.points[i - 1].lat,
          this.points[i - 1].lon,
          this.points[i].lat,
          this.points[i].lon
        );
      }
      this.totalDistanceKm = +(totalMeters / 1000).toFixed(3);
      this.cityPassages = [];
      console.log('Parsed points:', this.points.length, 'total km', this.totalDistanceKm);
      this.cd.detectChanges();
    } catch (err) {
      console.error('GPX parse error', err);
      this.points = [];
      this.totalDistanceKm = 0;
      this.parseMessage = 'Erreur lors du parsing GPX';
    }
  }

  haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // metres
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async computeSchedule() {
    if (this.points.length < 2) return;
    if (!this.departure) return;
    const departureDate = new Date(this.departure);
    if (isNaN(departureDate.getTime())) return;

    // set display date from departure (single-line above table)
    this.displayDate = formatDate(departureDate, 'dd/MM/yyyy', 'en-US');

    // cumulative distances
    const cumMeters: number[] = [0];
    for (let i = 1; i < this.points.length; i++) {
      cumMeters[i] = (cumMeters[i - 1] || 0) + this.haversineMeters(
        this.points[i - 1].lat,
        this.points[i - 1].lon,
        this.points[i].lat,
        this.points[i].lon
      );
    }

    // sample points by distance to limit reverse-geocoding calls (e.g. every 2km)
    const distanceStep = 2000; // meters between samples (reduce to fewer calls)
    this.loading = true;
    this.passages = [];
    this.progressText = 'Recherche des villes (échantillonnage par distance)...';
    // pick representative indices every distanceStep
    let lastSampleMeters = -Infinity;
    const sampleIndices: number[] = [];
    for (let i = 0; i < this.points.length; i++) {
      const meters = cumMeters[i] || 0;
      if (i === 0 || meters - lastSampleMeters >= distanceStep || i === this.points.length - 1) {
        sampleIndices.push(i);
        lastSampleMeters = meters;
      }
    }

    // helper: round coords to reduce duplicates (e.g. 2 decimals ~ ~1km)
    const roundCoord = (v: number, d = 2) => Number(v.toFixed(d));
    const seenCoords = new Set<string>();

    // throttle helper
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // reverse-geocode unique rounded coordinates, throttled to ~1 req/s
    const coordToCity = new Map<string, string>();
    for (let idx = 0; idx < sampleIndices.length; idx++) {
      const i = sampleIndices[idx];
      const lat = this.points[i].lat;
      const lon = this.points[i].lon;
      const key = `${roundCoord(lat, 2)}_${roundCoord(lon, 2)}`;
      const meters = cumMeters[i] || 0;
      const hours = (meters / 1000) / (this.avgSpeed || 1);
      const time = new Date(departureDate.getTime() + Math.round(hours * 3600 * 1000));

      if (seenCoords.has(key)) {
        // duplicate area, skip reverse-geocoding
        const city = coordToCity.get(key) || 'Inconnu';
        this.passages.push({ city, lat, lon, time, status: 'pending' });
      } else {
        seenCoords.add(key);
        // be polite: wait ~1.1s between Nominatim calls to avoid rate limits
        try {
          await delay(1100);
          const city = await this.reverseGeocode(lat, lon);
          coordToCity.set(key, city);
          this.passages.push({ city, lat, lon, time, status: 'pending' });
        } catch (err: any) {
          coordToCity.set(key, 'Inconnu');
          this.passages.push({ city: 'Inconnu', lat, lon, time, status: 'error', message: err?.message || 'Reverse geocode failed' });
        }
      }
      this.progressText = `Recherche des villes... (${this.passages.length} passages échantillonnés, ${coordToCity.size} géocodages)`;
      this.cd.detectChanges();
    }

    // Filter out unknown cities and consecutive duplicates to keep results concise
    const filtered: typeof this.passages = [];
    let lastCity: string | null = null;
    for (const p of this.passages) {
      const cityName = (p.city || '').trim();
      if (!cityName || cityName.toLowerCase() === 'inconnu') {
        // skip unknown
        continue;
      }
      if (lastCity && lastCity === cityName) {
        // skip consecutive duplicate
        continue;
      }
      filtered.push(p);
      lastCity = cityName;
    }
    this.passages = filtered;

    // now fetch weather for each (filtered) passage (sequential to avoid quota spikes)
    this.progressText = `Récupération météo pour ${this.passages.length} passages...`;
    for (let idx = 0; idx < this.passages.length; idx++) {
      const p = this.passages[idx];
      if (p.status === 'pending') {
        try {
          const dateStr = formatDate(p.time, 'yyyy-MM-dd', 'en-US');
          const weather = await this.weatherService.getWeather(p.city, dateStr);
          const targetHour = p.time.getHours();
          const found = weather.hourly.find(h => new Date(h.hour).getHours() === targetHour) || weather.hourly.reduce((a,b)=>Math.abs(new Date(a.hour).getTime()-p.time.getTime())<Math.abs(new Date(b.hour).getTime()-p.time.getTime())?a:b);
          if (found) {
            p.weather = { temperature: found.temperature, code: found.summary };
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
    this.cd.detectChanges();
  }

  reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    return new Promise((resolve, reject) => {
      this.http.get<any>(url).subscribe({
        next: res => {
          const addr = res?.address;
          const city = addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || '';
          resolve(city || 'Inconnu');
        },
        error: err => reject(err)
      });
    });
  }

  getWeatherDescription(code: number | undefined) {
    if (code === undefined || code === null) return { emoji: '❓', desc: 'Inconnu' };
    // reuse WeatherSheetComponent mapping
    const ws = new WeatherSheetComponent();
    return ws.getWeatherDescription(code);
  }

  // Convert wind degrees to cardinal direction (N, NE, E, ...)
  degreesToCardinal(deg: number | undefined) {
    if (deg === undefined || deg === null || isNaN(deg)) return '';
    const directions = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const idx = Math.floor(((deg % 360) / 22.5) + 0.5) % 16;
    return `${Math.round(deg)}° ${directions[idx]}`;
  }
}
