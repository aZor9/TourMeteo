import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../../service/weather.service';
import { getWeatherDescription, degreesToCardinal } from '../../utils/weather-utils';
import { RecentCitiesService } from '../../service/recent-cities.service';

export interface RunHourWeather {
  hour: string;
  displayHour: string;
  temperature: number;
  apparentTemperature: number;
  wind: number;
  windDir: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number;
  code: number;
  isDay: boolean;
}

interface ClothingItem { emoji: string; label: string; }

@Component({
  selector: 'app-running',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './running.component.html'
})
export class RunningComponent {

  // ─── Form ───
  city = '';
  date = '';
  startTime = '08:00';
  inputMode: 'duration' | 'distance' = 'duration';
  durationH = 1;
  durationM = 0;
  distanceKm = 10;
  paceMin = 5;
  paceSec = 30;

  // ─── State ───
  loading = false;
  error = '';

  // ─── City suggestions ───
  citySuggestions: string[] = [];
  showSuggestions = false;

  // ─── Results ───
  hours: RunHourWeather[] = [];
  totalDurationMin = 0;
  displayDate = '';
  resolvedCity = '';

  // ─── Run score ───
  runScore = 0;
  runScoreLabel = '';
  runScoreColor = '';
  runScoreEmoji = '';
  clothingItems: ClothingItem[] = [];
  warnings: string[] = [];
  tips: string[] = [];
  nutritionTips: string[] = [];

  avgTemp = 0;
  avgApparentTemp = 0;
  avgWind = 0;
  avgHumidity = 0;
  maxPrecipProb = 0;
  totalPrecip = 0;

  constructor(
    private cd: ChangeDetectorRef,
    private weatherService: WeatherService,
    public recentCities: RecentCitiesService
  ) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.date = `${yyyy}-${mm}-${dd}`;
  }

  // ─── Computed helpers ───

  get computedDurationMin(): number {
    if (this.inputMode === 'duration') {
      return (this.durationH || 0) * 60 + (this.durationM || 0);
    }
    const pacePerKm = (this.paceMin || 0) + (this.paceSec || 0) / 60;
    return Math.round((this.distanceKm || 0) * pacePerKm);
  }

  get computedDistanceKm(): number {
    if (this.inputMode === 'distance') return this.distanceKm || 0;
    const pacePerKm = (this.paceMin || 0) + (this.paceSec || 0) / 60;
    if (pacePerKm <= 0) return 0;
    return +(this.computedDurationMin / pacePerKm).toFixed(1);
  }

  get durationText(): string {
    const mins = this.totalDurationMin > 0 ? this.totalDurationMin : this.computedDurationMin;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  }

  // ─── Compute ───

  async compute() {
    if (!this.city || !this.date || !this.startTime) return;

    this.recentCities.add(this.city);
    this.showSuggestions = false;
    this.loading = true;
    this.error = '';
    this.hours = [];

    try {
      this.totalDurationMin = this.computedDurationMin;
      if (this.totalDurationMin <= 0) {
        this.error = 'Durée invalide';
        this.loading = false;
        return;
      }

      const weather = await this.weatherService.getWeather(this.city, this.date);
      this.resolvedCity = weather.city;
      this.displayDate = this.date.split('-').reverse().join('/');

      const [sh, sm] = this.startTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = startMin + this.totalDurationMin;

      const startHour = Math.floor(startMin / 60);
      const endHour = Math.min(23, Math.ceil(endMin / 60));

      this.hours = [];
      for (const h of weather.hourly) {
        const hDate = new Date(h.hour);
        const hh = hDate.getHours();
        if (hh >= startHour && hh <= endHour) {
          this.hours.push({
            hour: h.hour,
            displayHour: `${String(hh).padStart(2, '0')}:00`,
            temperature: h.temperature,
            apparentTemperature: h.apparentTemperature ?? h.temperature,
            wind: h.wind,
            windDir: h.windDir ?? 0,
            humidity: h.humidity ?? 50,
            precipitation: h.precipitation ?? 0,
            precipitationProbability: h.precipitationProbability ?? 0,
            code: h.summary,
            isDay: h.isDay
          });
        }
      }

      if (this.hours.length === 0) {
        this.error = 'Aucune donnée météo disponible pour ces heures';
        this.loading = false;
        return;
      }

      this.computeRunScore();

    } catch (err: any) {
      this.error = err?.message || 'Erreur lors de la récupération météo';
    }

    this.loading = false;
    this.cd.detectChanges();
  }

  // ─── Run score computation ───

  private computeRunScore() {
    const temps = this.hours.map(h => h.temperature);
    const apparents = this.hours.map(h => h.apparentTemperature);
    const winds = this.hours.map(h => h.wind);
    const humidities = this.hours.map(h => h.humidity);
    const precipProbs = this.hours.map(h => h.precipitationProbability);
    const precips = this.hours.map(h => h.precipitation);
    const codes = this.hours.map(h => h.code);

    this.avgTemp = +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
    this.avgApparentTemp = +(apparents.reduce((a, b) => a + b, 0) / apparents.length).toFixed(1);
    this.avgWind = +(winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1);
    this.avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
    this.maxPrecipProb = Math.max(...precipProbs);
    this.totalPrecip = +(precips.reduce((a, b) => a + b, 0)).toFixed(1);

    const hasRain = this.maxPrecipProb > 30 || this.totalPrecip > 0.5;
    const hasStrongWind = Math.max(...winds) > 35;
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minApparent = Math.min(...apparents);
    const hasStorm = codes.some(c => c >= 95);
    const hasFog = codes.some(c => c === 45 || c === 48);

    // ─── Score (0-100) ───
    let score = 100;

    // Temperature (runners overheat faster)
    if (this.avgTemp < 0) score -= 30;
    else if (this.avgTemp < 5) score -= 20;
    else if (this.avgTemp < 10) score -= 5;
    else if (this.avgTemp > 32) score -= 30;
    else if (this.avgTemp > 28) score -= 15;
    else if (this.avgTemp > 25) score -= 5;

    // Wind
    if (this.avgWind > 50) score -= 25;
    else if (this.avgWind > 40) score -= 15;
    else if (this.avgWind > 30) score -= 10;
    else if (this.avgWind > 20) score -= 5;

    // Precipitation
    if (this.totalPrecip > 5) score -= 25;
    else if (this.totalPrecip > 2) score -= 15;
    else if (this.totalPrecip > 0.5) score -= 8;
    if (this.maxPrecipProb > 70) score -= 10;
    else if (this.maxPrecipProb > 40) score -= 5;

    // Special conditions
    if (hasStorm) score -= 20;
    if (hasFog) score -= 5;
    if (this.avgTemp > 25 && this.avgHumidity > 70) score -= 15; // humidity matters more for running

    score = Math.max(0, Math.min(100, score));
    this.runScore = score;

    if (score >= 85) { this.runScoreLabel = 'Excellente'; this.runScoreColor = 'text-green-600'; this.runScoreEmoji = '🟢'; }
    else if (score >= 70) { this.runScoreLabel = 'Bonne'; this.runScoreColor = 'text-lime-600'; this.runScoreEmoji = '🟡'; }
    else if (score >= 50) { this.runScoreLabel = 'Correcte'; this.runScoreColor = 'text-amber-500'; this.runScoreEmoji = '🟠'; }
    else if (score >= 30) { this.runScoreLabel = 'Difficile'; this.runScoreColor = 'text-orange-600'; this.runScoreEmoji = '🔴'; }
    else { this.runScoreLabel = 'Déconseillée'; this.runScoreColor = 'text-red-600'; this.runScoreEmoji = '⛔'; }

    // ─── Clothing (running-specific) ───
    this.clothingItems = [];

    // Bottom
    if (minApparent >= 18) this.clothingItems.push({ emoji: '🩳', label: 'Short running' });
    else if (minApparent >= 10) this.clothingItems.push({ emoji: '🩳', label: 'Collant 3/4' });
    else this.clothingItems.push({ emoji: '🦵', label: 'Collant long' });

    // Top
    if (minApparent >= 20) this.clothingItems.push({ emoji: '🏃', label: 'Débardeur / singlet' });
    else if (minApparent >= 14) this.clothingItems.push({ emoji: '👕', label: 'T-shirt respirant' });
    else if (minApparent >= 8) this.clothingItems.push({ emoji: '🧵', label: 'Maillot manches longues' });
    else this.clothingItems.push({ emoji: '🧶', label: 'Sous-couche thermique + maillot' });

    // Layer
    if (minApparent < 5) this.clothingItems.push({ emoji: '🧥', label: 'Veste running coupe-vent' });
    else if (minApparent < 10 || hasStrongWind) this.clothingItems.push({ emoji: '🦺', label: 'Gilet coupe-vent léger' });

    // Rain
    if (hasRain && this.maxPrecipProb > 50) this.clothingItems.push({ emoji: '🌧️', label: 'Veste imperméable légère' });

    // Accessories
    if (minApparent < 5) this.clothingItems.push({ emoji: '🧤', label: 'Gants running' });
    if (minApparent < 3) this.clothingItems.push({ emoji: '🎧', label: 'Bandeau / bonnet' });
    if (this.avgTemp > 22 || codes.some(c => c === 0 || c === 1)) this.clothingItems.push({ emoji: '🧢', label: 'Casquette' });
    if (codes.some(c => c === 0 || c === 1)) this.clothingItems.push({ emoji: '🕶️', label: 'Lunettes de soleil' });
    this.clothingItems.push({ emoji: '👟', label: hasRain ? 'Chaussures trail / grip' : 'Chaussures running' });

    // ─── Warnings ───
    this.warnings = [];
    if (hasStorm) this.warnings.push('⛈️ Orages prévus — sortie fortement déconseillée');
    if (hasStrongWind) this.warnings.push(`💨 Vent fort (max ${Math.round(Math.max(...winds))} km/h) — difficile de maintenir l'allure`);
    if (this.totalPrecip > 5) this.warnings.push(`🌧️ Pluie abondante (${this.totalPrecip} mm) — sol glissant`);
    if (minTemp < 0) this.warnings.push('🧊 Températures négatives — risque de verglas');
    if (hasFog) this.warnings.push('🌫️ Brouillard — portez des vêtements réfléchissants');
    if (this.avgTemp > 30) this.warnings.push('🥵 Forte chaleur — risque de coup de chaleur, ralentissez le rythme');
    if (this.avgTemp > 25 && this.avgHumidity > 70) this.warnings.push('💧 Chaleur humide — le corps évacue mal la chaleur');

    // ─── Tips ───
    this.tips = [];
    const durationH = this.totalDurationMin / 60;

    if (this.avgTemp > 22) this.tips.push('💦 Hydratez-vous toutes les 15-20 min (150-250 ml)');
    else this.tips.push('💦 Buvez au moins 500 ml/h même par temps frais');

    if (durationH > 1) this.tips.push('⏱️ Sortie longue — pensez à un ravitaillement liquide');
    if (this.avgWind > 15 && this.avgWind <= 30) this.tips.push(`🍃 Vent modéré (${this.avgWind} km/h) — partez face au vent, revenez vent dans le dos`);
    const tempRange = maxTemp - minTemp;
    if (tempRange > 6) this.tips.push(`🌡️ Écart de ${tempRange.toFixed(0)}° pendant la sortie — prévoyez une couche amovible`);
    if (this.avgTemp > 25) this.tips.push('🧊 Mouillez votre casquette et nuque pour rester frais');
    if (this.avgHumidity > 75) this.tips.push(`💧 Humidité élevée (${this.avgHumidity}%) — ajustez votre allure à la baisse`);

    // ─── Nutrition tips ───
    this.nutritionTips = [];
    if (durationH >= 1) {
      this.nutritionTips.push('🥤 Emportez une boisson isotonique ou de l\'eau');
    }
    if (durationH >= 1.25) {
      this.nutritionTips.push('🍬 Prévoyez un gel énergétique (~25g glucides) toutes les 30-45 min après 45 min d\'effort');
    }
    if (durationH >= 1.5) {
      this.nutritionTips.push('🍌 Emportez une barre ou banane pour les sorties de +90 min');
      this.nutritionTips.push('🧂 Ajoutez des électrolytes à votre boisson (sodium, potassium)');
    }
    if (durationH >= 2) {
      this.nutritionTips.push('🔋 Visez 30-60g de glucides/h pour maintenir l\'énergie');
    }
    if (this.avgTemp > 28 && durationH >= 1) {
      this.nutritionTips.push('🌡️ Par forte chaleur, augmentez l\'apport en eau (+50%) et en sel');
    }
  }

  // ─── Utils ───
  weatherEmoji(code: number): string { return getWeatherDescription(code).emoji; }
  weatherDesc(code: number): string { return getWeatherDescription(code).desc; }
  windCardinal(deg: number): string { return degreesToCardinal(deg); }
}
