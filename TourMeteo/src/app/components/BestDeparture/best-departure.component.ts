import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../../service/weather.service';
import { CityService } from '../../service/city.service';
import { getWeatherDescription, degreesToCardinal } from '../../utils/weather-utils';
import { RecentCitiesService } from '../../service/recent-cities.service';
import { Router } from '@angular/router';
import { GpxStateService } from '../../service/gpx-state.service';
import { FeatureFlagService } from '../../service/feature-flag.service';

interface DepartureOption {
  hour: number;
  displayHour: string;
  dateLabel: string;
  dateIso: string;
  score: number;
  scoreLabel: string;
  scoreColor: string;
  scoreEmoji: string;
  avgTemp: number;
  avgApparentTemp: number;
  avgWind: number;
  maxPrecipProb: number;
  totalPrecip: number;
  avgHumidity: number;
  headwindPercent: number;
  sunPercent: number;
  warnings: string[];
  isBest: boolean;
}

interface ParsedGPXPoint {
  lat: number;
  lon: number;
}

@Component({
  selector: 'app-best-departure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './best-departure.component.html'
})
export class BestDepartureComponent implements OnInit {

  // ─── Form ───
  avgSpeedKmh = 25;
  minHour = 6;
  maxHour = 20;
  numDays = 1;
  manualCity = '';
  manualDate = '';

  // ─── GPX parsing ───
  gpxFileName = '';
  gpxPoints: ParsedGPXPoint[] = [];
  gpxDistanceKm = 0;

  // ─── State ───
  loading = false;
  error = '';
  progressText = '';
  computeMode: 'gpx' | 'manual' = 'gpx';

  // ─── Results ───
  options: DepartureOption[] = [];
  bestOption: DepartureOption | null = null;
  routeCity = '';
  routeDate = '';
  routeLat = 0;
  routeLon = 0;

  // ─── City suggestions ───
  citySuggestions: string[] = [];
  showSuggestions = false;

  constructor(
    private cd: ChangeDetectorRef,
    private weatherService: WeatherService,
    private cityService: CityService,
    public recentCities: RecentCitiesService,
    private gpxState: GpxStateService,
    private router: Router,
    private featureFlags: FeatureFlagService
  ) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.manualDate = `${yyyy}-${mm}-${dd}`;
  }

  ngOnInit() {
    if (this.gpxState.has() && !this.gpxFileName) {
      const s = this.gpxState.get()!;
      this.gpxPoints = s.points;
      this.gpxFileName = s.fileName;
      this.gpxDistanceKm = s.distanceKm;
      this.computeMode = 'gpx';
    }
  }

  goToGpx() {
    this.router.navigate(['/gpx']);
  }

  // ─── GPX file handling ───

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.gpxFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => this.parseGPX(reader.result as string);
    reader.readAsText(file);
  }

  private parseGPX(xmlStr: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const trkpts = doc.querySelectorAll('trkpt');
    this.gpxPoints = [];
    trkpts.forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat') || '0');
      const lon = parseFloat(pt.getAttribute('lon') || '0');
      if (lat && lon) this.gpxPoints.push({ lat, lon });
    });

    // Calculate distance
    this.gpxDistanceKm = 0;
    for (let i = 1; i < this.gpxPoints.length; i++) {
      this.gpxDistanceKm += this.haversine(
        this.gpxPoints[i - 1].lat, this.gpxPoints[i - 1].lon,
        this.gpxPoints[i].lat, this.gpxPoints[i].lon
      );
    }
    this.gpxDistanceKm = +this.gpxDistanceKm.toFixed(1);
    this.gpxState.set({ points: this.gpxPoints, fileName: this.gpxFileName, distanceKm: this.gpxDistanceKm });
    this.cd.detectChanges();
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── Compute ───

  get durationHours(): number {
    if (this.computeMode === 'gpx') {
      return this.gpxDistanceKm > 0 && this.avgSpeedKmh > 0 ? this.gpxDistanceKm / this.avgSpeedKmh : 0;
    } else {
      return 0; // manual mode just checks all hours
    }
  }

  get durationText(): string {
    const totalMin = Math.round(this.durationHours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  }

  get canCompute(): boolean {
    if (this.computeMode === 'gpx') return this.gpxPoints.length > 0 && this.avgSpeedKmh > 0;
    return !!this.manualCity && !!this.manualDate;
  }

  async compute() {
    if (!this.canCompute) return;

    this.loading = true;
    this.error = '';
    this.options = [];
    this.bestOption = null;
    this.showSuggestions = false;
    this.progressText = 'Récupération de la météo...';
    this.cd.detectChanges();

    try {
      let routeBearing = 0;
      let cityName = '';

      if (this.computeMode === 'gpx') {
        const mid = this.gpxPoints[Math.floor(this.gpxPoints.length / 2)];
        this.routeLat = mid.lat;
        this.routeLon = mid.lon;
        cityName = await this.reverseGeocode(mid.lat, mid.lon);
        this.routeCity = cityName;

        if (this.gpxPoints.length >= 2) {
          const first = this.gpxPoints[0];
          const last = this.gpxPoints[this.gpxPoints.length - 1];
          routeBearing = this.bearing(first.lat, first.lon, last.lat, last.lon);
        }
      } else {
        const coords = await this.cityService.getLatLon(this.manualCity);
        this.routeLat = parseFloat(coords.lat);
        this.routeLon = parseFloat(coords.lon);
        await this.delay(1100);
        cityName = this.manualCity;
        this.routeCity = cityName;
        this.recentCities.add(cityName);
      }

      const durationH = this.computeMode === 'gpx'
        ? Math.ceil(this.durationHours)
        : 2;

      const days = Math.max(1, Math.min(7, this.numDays));
      const baseDate = new Date(this.manualDate + 'T00:00:00');
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

      for (let d = 0; d < days; d++) {
        const dayDate = new Date(baseDate);
        dayDate.setDate(dayDate.getDate() + d);
        const dateIso = dayDate.toISOString().slice(0, 10);
        const dayLabel = `${dayNames[dayDate.getDay()]} ${dayDate.getDate()}/${dayDate.getMonth() + 1}`;

        this.progressText = days > 1
          ? `Météo jour ${d + 1}/${days} (${dayLabel})...`
          : 'Analyse des créneaux horaires...';
        this.cd.detectChanges();

        const weatherCity = await this.weatherService.getWeather(cityName, dateIso);
        if (d === 0) this.routeDate = dateIso;

        for (let h = this.minHour; h <= this.maxHour; h++) {
          const endH = Math.min(23, h + durationH);
          const relevantHours = weatherCity.hourly.filter((hw: any) => {
            const hDate = new Date(hw.hour);
            return hDate.getHours() >= h && hDate.getHours() <= endH;
          });

          if (relevantHours.length === 0) continue;

          const avgTemp = relevantHours.reduce((s: number, x: any) => s + x.temperature, 0) / relevantHours.length;
          const avgApparent = relevantHours.reduce((s: number, x: any) => s + (x.apparentTemperature ?? x.temperature), 0) / relevantHours.length;
          const avgWind = relevantHours.reduce((s: number, x: any) => s + x.wind, 0) / relevantHours.length;
          const avgHumidity = relevantHours.reduce((s: number, x: any) => s + (x.humidity ?? 50), 0) / relevantHours.length;
          const apiMaxPrecipProb = Math.max(...relevantHours.map((x: any) => x.precipitationProbability ?? 0));
          const totalPrecip = relevantHours.reduce((s: number, x: any) => s + (x.precipitation ?? 0), 0);

          // Fallback: use weather codes to estimate rain when API probability is 0
          const codes = relevantHours.map((x: any) => x.summary ?? 0);
          const rainyCodeCount = codes.filter((c: number) => c >= 51 && c !== 45 && c !== 48).length;
          const codeBasedProb = relevantHours.length > 0 ? Math.round((rainyCodeCount / relevantHours.length) * 100) : 0;
          const maxPrecipProb = Math.max(apiMaxPrecipProb, codeBasedProb, totalPrecip > 0.5 ? 40 : 0);

          const sunCount = relevantHours.filter((x: any) => x.isDay).length;
          const sunPercent = Math.round((sunCount / relevantHours.length) * 100);

          let headwindPercent = 0;
          if (routeBearing > 0) {
            let headwindCount = 0;
            for (const hw of relevantHours) {
              const windDir = hw.windDir ?? 0;
              const diff = Math.abs(windDir - routeBearing);
              const angleDiff = diff > 180 ? 360 - diff : diff;
              if (angleDiff > 90) headwindCount++;
            }
            headwindPercent = Math.round(((relevantHours.length - headwindCount) / relevantHours.length) * 100);
          }

          const score = this.computeScore(avgTemp, avgApparent, avgWind, maxPrecipProb, totalPrecip, avgHumidity, sunPercent, headwindPercent);
          const { label, color, emoji } = this.scoreLabel(score);

          const warnings: string[] = [];
          if (avgTemp < 2) warnings.push('🥶 Températures glaciales');
          else if (avgTemp < 8) warnings.push('🧊 Froid — couvrez-vous bien');
          if (avgTemp > 33) warnings.push('🔥 Chaleur extrême — risque insolation');
          else if (avgTemp > 28) warnings.push('☀️ Chaleur — hydratation renforcée');
          if (maxPrecipProb > 70) warnings.push('🌧️ Forte probabilité de pluie');
          if (avgWind > 40) warnings.push('💨 Vent très fort');
          if (h >= 18) warnings.push('🌙 Sortie en soirée / nuit');

          this.options.push({
            hour: h,
            displayHour: `${String(h).padStart(2, '0')}:00`,
            dateLabel: dayLabel,
            dateIso,
            score: Math.round(score),
            scoreLabel: label,
            scoreColor: color,
            scoreEmoji: emoji,
            avgTemp: +avgTemp.toFixed(1),
            avgApparentTemp: +avgApparent.toFixed(1),
            avgWind: +avgWind.toFixed(0),
            maxPrecipProb,
            totalPrecip: +totalPrecip.toFixed(1),
            avgHumidity: +avgHumidity.toFixed(0),
            headwindPercent,
            sunPercent,
            warnings,
            isBest: false
          });
        }
      }

      // Find best option
      if (this.options.length > 0) {
        const best = this.options.reduce((a, b) => a.score > b.score ? a : b);
        best.isBest = true;
        this.bestOption = best;
      }

      this.progressText = '';
      this.loading = false;
      this.cd.detectChanges();

    } catch (err: any) {
      this.error = err?.message || 'Erreur lors de l\'analyse';
      this.loading = false;
      this.progressText = '';
      this.cd.detectChanges();
    }
  }

  // ─── Scoring ───

  private computeScore(
    avgTemp: number, avgApparent: number, avgWind: number,
    maxPrecipProb: number, totalPrecip: number,
    avgHumidity: number, sunPercent: number, headwindPercent: number
  ): number {
    let score = 100;

    // Temperature (ideal 14-22°C for cycling)
    if (avgTemp < 0) score -= 35;
    else if (avgTemp < 5) score -= 20;
    else if (avgTemp < 10) score -= 10;
    else if (avgTemp < 14) score -= 5;
    else if (avgTemp > 35) score -= 30;
    else if (avgTemp > 30) score -= 20;
    else if (avgTemp > 26) score -= 10;
    else if (avgTemp > 22) score -= 3;

    // Wind
    if (avgWind > 50) score -= 25;
    else if (avgWind > 35) score -= 15;
    else if (avgWind > 20) score -= 8;
    else if (avgWind > 12) score -= 3;

    // Headwind penalty
    if (headwindPercent > 70) score -= 10;
    else if (headwindPercent > 50) score -= 5;

    // Rain
    if (maxPrecipProb > 80) score -= 20;
    else if (maxPrecipProb > 60) score -= 12;
    else if (maxPrecipProb > 40) score -= 6;
    else if (maxPrecipProb > 20) score -= 2;

    if (totalPrecip > 5) score -= 15;
    else if (totalPrecip > 2) score -= 8;
    else if (totalPrecip > 0.5) score -= 3;

    // Humidity
    if (avgHumidity > 85) score -= 8;
    else if (avgHumidity > 70) score -= 3;

    // Sun bonus
    if (sunPercent === 100) score += 5;
    else if (sunPercent < 30) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private scoreLabel(score: number): { label: string; color: string; emoji: string } {
    if (score >= 85) return { label: 'Excellent', color: 'text-emerald-600', emoji: '🌟' };
    if (score >= 70) return { label: 'Très bon', color: 'text-green-600', emoji: '✅' };
    if (score >= 55) return { label: 'Bon', color: 'text-lime-600', emoji: '👍' };
    if (score >= 40) return { label: 'Correct', color: 'text-amber-500', emoji: '🟡' };
    if (score >= 25) return { label: 'Médiocre', color: 'text-orange-500', emoji: '⚠️' };
    return { label: 'Déconseillé', color: 'text-red-500', emoji: '🛑' };
  }

  /** Unique dates for multi-day display */
  get uniqueDays(): string[] {
    return [...new Set(this.options.map(o => o.dateLabel))];
  }

  optionsForDay(day: string): DepartureOption[] {
    return this.options.filter(o => o.dateLabel === day);
  }

  // ─── Helpers ───

  private async reverseGeocode(lat: number, lon: number): Promise<string> {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&email=hugo.lembrez@gmail.com`, {
      headers: {
        'User-Agent': 'MeteoRide/2.2.0 (https://meteo-ride.vercel.app)',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0] || `${lat.toFixed(2)},${lon.toFixed(2)}`;
  }

  private bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
