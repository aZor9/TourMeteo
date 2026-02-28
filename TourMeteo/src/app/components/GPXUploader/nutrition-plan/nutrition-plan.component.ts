import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Passage } from '../../../models/passage.model';

interface NutritionSlot {
  timeLabel: string;
  distanceKm: number;
  typeEmoji: string;
  typeLabel: string;
  carbsG: number;
  hydrationMl: number;
  note?: string;
}

@Component({
  selector: 'app-nutrition-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition-plan.component.html'
})
export class NutritionPlanComponent implements OnChanges {
  @Input() passages: Passage[] = [];
  @Input() totalDistanceKm = 0;
  @Input() durationText = '';

  /** Target carbs per hour (g/h), user can customize */
  targetCarbsPerHour = 60;
  showCustomTarget = false;

  slots: NutritionSlot[] = [];
  totalCarbs = 0;
  totalHydration = 0;
  durationHours = 0;

  summary = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['passages'] || changes['durationText']) {
      this.computePlan();
    }
  }

  onTargetChange() {
    this.computePlan();
  }

  computePlan() {
    this.slots = [];
    this.totalCarbs = 0;
    this.totalHydration = 0;

    if (this.passages.length < 2) return;

    const okPassages = this.passages.filter(p => p.status === 'ok');
    if (okPassages.length < 2) return;

    const dep = okPassages[0].time;
    const arr = okPassages[okPassages.length - 1].time;
    this.durationHours = (arr.getTime() - dep.getTime()) / 3600000;
    if (this.durationHours <= 0) return;

    // Determine avg temperature for hydration adjustment
    const avgTemp = okPassages.reduce((s, p) => s + (p.weather?.temperature ?? 20), 0) / okPassages.length;
    const avgHumidity = okPassages.reduce((s, p) => s + (p.weather?.humidity ?? 50), 0) / okPassages.length;
    const isHot = avgTemp > 25;
    const isVeryHot = avgTemp > 30;
    const isHumid = avgHumidity > 70;

    // Base hydration ml/h
    let hydrationPerHour = 500; // base
    if (isHot) hydrationPerHour = 650;
    if (isVeryHot) hydrationPerHour = 750;
    if (isHot && isHumid) hydrationPerHour = 800;

    const carbsPerHour = Math.max(20, Math.min(120, this.targetCarbsPerHour || 60));

    // Generate nutrition slots every ~30 minutes
    const intervalMin = 30;
    const totalMinutes = Math.round(this.durationHours * 60);

    // Nutrition types rotation
    const nutritionTypes = [
      { emoji: '🥤', label: 'Gorgée de boisson isotonique', carbs: 15 },
      { emoji: '🍬', label: 'Gel énergétique', carbs: 25 },
      { emoji: '🥤', label: 'Gorgée de boisson isotonique', carbs: 15 },
      { emoji: '🍌', label: 'Barre / banane', carbs: 30 },
    ];

    // First 30 min: just water
    this.slots.push({
      timeLabel: this.formatMinutes(0),
      distanceKm: 0,
      typeEmoji: '💧',
      typeLabel: 'Eau pure (début d\'effort)',
      carbsG: 0,
      hydrationMl: Math.round(hydrationPerHour / 4),
      note: 'Hydratation de départ'
    });

    let typeIdx = 0;
    for (let min = intervalMin; min < totalMinutes; min += intervalMin) {
      const fraction = min / totalMinutes;
      const distKm = +(this.totalDistanceKm * fraction).toFixed(1);
      const hourFraction = min / 60;

      // Pick nutrition type
      const type = nutritionTypes[typeIdx % nutritionTypes.length];
      typeIdx++;

      // Scale carbs to target
      const carbsForSlot = Math.round((carbsPerHour * intervalMin) / 60);
      const hydrationForSlot = Math.round((hydrationPerHour * intervalMin) / 60);

      // After first 30 min of effort, start feeding
      if (min >= 30) {
        this.slots.push({
          timeLabel: this.formatMinutes(min),
          distanceKm: distKm,
          typeEmoji: type.emoji,
          typeLabel: type.label,
          carbsG: carbsForSlot,
          hydrationMl: hydrationForSlot,
          note: min >= totalMinutes - 30 ? 'Dernière prise avant l\'arrivée' : undefined
        });
      } else {
        this.slots.push({
          timeLabel: this.formatMinutes(min),
          distanceKm: distKm,
          typeEmoji: '💧',
          typeLabel: 'Eau / boisson',
          carbsG: 0,
          hydrationMl: hydrationForSlot
        });
      }
    }

    this.totalCarbs = this.slots.reduce((s, sl) => s + sl.carbsG, 0);
    this.totalHydration = this.slots.reduce((s, sl) => s + sl.hydrationMl, 0);

    // Summary
    const bidons = Math.ceil(this.totalHydration / 750);
    const gels = Math.ceil(this.totalCarbs / 25);
    this.summary = `~${this.totalCarbs}g de glucides · ~${(this.totalHydration / 1000).toFixed(1)}L d'eau · ${bidons} bidon${bidons > 1 ? 's' : ''} de 750ml · ~${gels} gel${gels > 1 ? 's' : ''} équivalent`;

    // Add hot weather warning
    if (isVeryHot) {
      this.summary += ' · ⚠️ Chaleur forte : augmentez l\'hydratation';
    }
    if (isHot && isHumid) {
      this.summary += ' · 💧 Chaleur humide : ajoutez des pastilles de sel';
    }
  }

  private formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }
}
