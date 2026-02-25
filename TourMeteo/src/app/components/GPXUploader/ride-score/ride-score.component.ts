import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Passage } from '../../../models/passage.model';

interface ClothingItem {
  emoji: string;
  label: string;
}

@Component({
  selector: 'app-ride-score',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ride-score.component.html'
})
export class RideScoreComponent implements OnChanges {
  @Input() passages: Passage[] = [];
  @Input() totalDistanceKm = 0;

  rideScore = 0;
  rideScoreLabel = '';
  rideScoreColor = '';
  rideScoreEmoji = '';
  clothingItems: ClothingItem[] = [];
  rideWarnings: string[] = [];
  rideTips: string[] = [];
  avgTemp = 0;
  avgApparentTemp = 0;
  avgWind = 0;
  avgHumidity = 0;
  maxPrecipProb = 0;
  totalPrecip = 0;

  private hasRain = false;
  private hasStrongWind = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['passages']) {
      this.computeRideScore();
    }
  }

  computeRideScore() {
    const okPassages = this.passages.filter(p => p.status === 'ok' && p.weather);
    if (okPassages.length === 0) {
      this.rideScore = 0;
      this.rideScoreLabel = 'Données insuffisantes';
      this.rideScoreColor = 'text-slate-400';
      this.rideScoreEmoji = '❓';
      this.clothingItems = [];
      this.rideWarnings = [];
      this.rideTips = [];
      return;
    }

    const temps = okPassages.map(p => p.weather!.temperature ?? 0);
    const apparents = okPassages.map(p => p.weather!.apparentTemperature ?? p.weather!.temperature ?? 0);
    const winds = okPassages.map(p => p.weather!.wind ?? 0);
    const humidities = okPassages.map(p => p.weather!.humidity ?? 50);
    const precipProbs = okPassages.map(p => p.weather!.precipitationProbability ?? 0);
    const precips = okPassages.map(p => p.weather!.precipitation ?? 0);
    const codes = okPassages.map(p => p.weather!.code ?? 0);

    this.avgTemp = +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
    this.avgApparentTemp = +(apparents.reduce((a, b) => a + b, 0) / apparents.length).toFixed(1);
    this.avgWind = +(winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1);
    this.avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
    this.maxPrecipProb = Math.max(...precipProbs);
    this.totalPrecip = +(precips.reduce((a, b) => a + b, 0)).toFixed(1);
    this.hasRain = this.maxPrecipProb > 30 || this.totalPrecip > 0.5;
    this.hasStrongWind = Math.max(...winds) > 35;

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minApparent = Math.min(...apparents);
    const hasStorm = codes.some(c => c >= 95);
    const hasFog = codes.some(c => c === 45 || c === 48);

    // --- Score calculation (0-100) ---
    let score = 100;

    if (this.avgTemp < 5) score -= 30;
    else if (this.avgTemp < 10) score -= 15;
    else if (this.avgTemp < 15) score -= 5;
    else if (this.avgTemp > 35) score -= 25;
    else if (this.avgTemp > 30) score -= 10;

    if (this.avgWind > 50) score -= 30;
    else if (this.avgWind > 40) score -= 20;
    else if (this.avgWind > 30) score -= 10;
    else if (this.avgWind > 20) score -= 5;

    if (this.totalPrecip > 5) score -= 25;
    else if (this.totalPrecip > 2) score -= 15;
    else if (this.totalPrecip > 0.5) score -= 8;
    if (this.maxPrecipProb > 70) score -= 10;
    else if (this.maxPrecipProb > 40) score -= 5;

    if (hasStorm) score -= 20;
    if (hasFog) score -= 5;
    if (this.avgTemp > 25 && this.avgHumidity > 70) score -= 10;

    score = Math.max(0, Math.min(100, score));
    this.rideScore = score;

    if (score >= 85) { this.rideScoreLabel = 'Excellente'; this.rideScoreColor = 'text-green-600'; this.rideScoreEmoji = '🟢'; }
    else if (score >= 70) { this.rideScoreLabel = 'Bonne'; this.rideScoreColor = 'text-lime-600'; this.rideScoreEmoji = '🟡'; }
    else if (score >= 50) { this.rideScoreLabel = 'Correcte'; this.rideScoreColor = 'text-amber-500'; this.rideScoreEmoji = '🟠'; }
    else if (score >= 30) { this.rideScoreLabel = 'Difficile'; this.rideScoreColor = 'text-orange-600'; this.rideScoreEmoji = '🔴'; }
    else { this.rideScoreLabel = 'Déconseillée'; this.rideScoreColor = 'text-red-600'; this.rideScoreEmoji = '⛔'; }

    // --- Clothing ---
    this.clothingItems = [];
    if (minApparent >= 18) this.clothingItems.push({ emoji: '🩳', label: 'Cuissard court' });
    else this.clothingItems.push({ emoji: '🦵', label: 'Cuissard long' });

    if (minApparent >= 20) this.clothingItems.push({ emoji: '👕', label: 'Pas de sous-maillot' });
    else if (minApparent >= 12) this.clothingItems.push({ emoji: '🧵', label: 'Sous-maillot manches courtes' });
    else this.clothingItems.push({ emoji: '🧶', label: 'Sous-maillot manches longues' });

    if (minApparent >= 15) this.clothingItems.push({ emoji: '🚴', label: 'Maillot manches courtes' });
    else this.clothingItems.push({ emoji: '🚴‍♂️', label: 'Maillot manches longues' });

    if (minApparent < 8 || (this.hasRain && this.totalPrecip > 1)) this.clothingItems.push({ emoji: '🧥', label: 'Veste avec manches' });
    else if (minApparent < 14 || this.hasStrongWind) this.clothingItems.push({ emoji: '🦺', label: 'Gilet coupe-vent (sans manches)' });

    if (this.hasRain && this.maxPrecipProb > 50) this.clothingItems.push({ emoji: '🌧️', label: 'Kawet / cape de pluie' });

    if (minApparent < 8) this.clothingItems.push({ emoji: '🧤', label: 'Gants longs' });
    else if (minApparent < 14) this.clothingItems.push({ emoji: '🧤', label: 'Gants courts / mitaines' });

    if (minApparent < 5 || (this.hasRain && this.totalPrecip > 2)) this.clothingItems.push({ emoji: '🥾', label: 'Couvre-chaussures' });
    if (minApparent < 5) this.clothingItems.push({ emoji: '🎧', label: 'Sous-casque / cache-oreilles' });
    if (codes.some(c => c === 0 || c === 1)) this.clothingItems.push({ emoji: '🕶️', label: 'Lunettes de soleil' });

    // --- Warnings ---
    this.rideWarnings = [];
    if (hasStorm) this.rideWarnings.push('⛈️ Orages prévus — sortie fortement déconseillée');
    if (this.hasStrongWind) this.rideWarnings.push(`💨 Vent fort (max ${Math.round(Math.max(...winds))} km/h) — prudence dans les descentes`);
    if (this.totalPrecip > 5) this.rideWarnings.push(`🌧️ Pluie abondante (${this.totalPrecip} mm) — routes glissantes`);
    if (minTemp < 2) this.rideWarnings.push('🧊 Risque de verglas — attention aux plaques de gel');
    if (hasFog) this.rideWarnings.push('🌫️ Brouillard — visibilité réduite, allumez vos feux');
    if (this.avgTemp > 32) this.rideWarnings.push('🥵 Forte chaleur — hydratez-vous régulièrement');

    // --- Tips ---
    this.rideTips = [];
    const tempRange = maxTemp - minTemp;
    if (tempRange > 8) this.rideTips.push(`🌡️ Écart de ${tempRange.toFixed(0)}° entre les villes — prévoyez des couches adaptables`);
    if (this.avgHumidity > 75) this.rideTips.push(`💧 Humidité élevée (${this.avgHumidity}%) — transpiration difficile à évacuer`);
    if (this.avgWind > 15 && this.avgWind <= 30) this.rideTips.push(`🍃 Vent modéré (${this.avgWind} km/h) — anticipez les rafales en peloton`);
    if (this.totalDistanceKm > 100) this.rideTips.push('🔋 Sortie longue (+100 km) — emportez ravitaillement et électrolytes');
    if (this.avgTemp > 25) this.rideTips.push('💦 Pensez à mouiller votre maillot et remplir vos bidons régulièrement');
    if (minApparent < 10 && maxTemp > 18) this.rideTips.push('🎒 Grand écart de ressenti — emportez un gilet dans la poche');
    if (this.maxPrecipProb > 30 && this.maxPrecipProb <= 50) this.rideTips.push('☂️ Risque de pluie modéré — gardez un coupe-vent léger à portée');
  }
}
