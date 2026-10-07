import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gpx-summary-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Distance</div>
        <div class="text-lg font-bold text-slate-800">{{ totalDistanceKm }} km</div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Durée</div>
        <div class="text-lg font-bold text-slate-800">{{ durationText }}</div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Horaires</div>
        <div class="text-lg font-bold text-slate-800">{{ departureTime }} → {{ arrivalTime }}</div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
        <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Villes</div>
        <div class="text-lg font-bold text-slate-800">{{ cityCount }}</div>
      </div>
    </div>
  `
})
export class GpxSummaryBarComponent {
  @Input() totalDistanceKm = 0;
  @Input() durationText = '';
  @Input() departureTime = '';
  @Input() arrivalTime = '';
  @Input() cityCount = 0;
}
