import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService, SavedRoute } from '../../../service/history.service';

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Toggle -->
    <button (click)="open = !open"
            class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors mb-3">
      <span class="text-lg">📂</span>
      Historique ({{ routes.length }})
      <svg class="w-4 h-4 transition-transform" [class.rotate-180]="open" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>

    <div *ngIf="open" class="mb-6 space-y-3">

      <!-- Storage bar -->
      <div class="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>💾 {{ storageInfo.usedKB }} KB / {{ storageInfo.totalKB }} KB</span>
          <span>{{ storageInfo.count }} trajet{{ storageInfo.count > 1 ? 's' : '' }}</span>
        </div>
        <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
               [style.width.%]="storageInfo.percent"
               [ngClass]="{
                 'bg-green-500': storageInfo.percent < 50,
                 'bg-amber-400': storageInfo.percent >= 50 && storageInfo.percent < 80,
                 'bg-red-500': storageInfo.percent >= 80
               }"></div>
        </div>
        <div *ngIf="storageInfo.percent >= 80" class="mt-2 text-xs text-red-600 font-medium">
          ⚠️ Stockage presque plein — pensez à supprimer d'anciens trajets
        </div>
        <button *ngIf="routes.length > 0" (click)="confirmClearAll()"
                class="mt-2 text-xs text-red-500 hover:text-red-700 hover:underline transition-colors">
          🗑️ Tout supprimer
        </button>
      </div>

      <!-- Confirm clear -->
      <div *ngIf="showClearConfirm" class="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
        <span class="text-sm text-red-700">Supprimer tout l'historique ?</span>
        <div class="flex gap-2">
          <button (click)="doClearAll()" class="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">Oui</button>
          <button (click)="showClearConfirm = false" class="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-300">Non</button>
        </div>
      </div>

      <!-- No history -->
      <div *ngIf="routes.length === 0" class="text-sm text-slate-400 text-center py-4">
        Aucun trajet sauvegardé
      </div>

      <!-- Route cards -->
      <div *ngFor="let r of routes; trackBy: trackById"
           class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
           (click)="load.emit(r)">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-slate-800 text-sm truncate">📄 {{ r.fileName }}</div>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
              <span>📅 {{ r.displayDate }}</span>
              <span>📏 {{ r.totalDistanceKm }} km</span>
              <span>📍 {{ r.cityCount }} villes</span>
              <span>⏱ {{ r.durationText }}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-1">Sauvegardé le {{ formatSavedAt(r.savedAt) }}</div>
          </div>
          <button (click)="removeRoute($event, r.id)"
                  class="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Supprimer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
})
export class HistoryPanelComponent implements OnInit {
  @Output() load = new EventEmitter<SavedRoute>();

  routes: SavedRoute[] = [];
  storageInfo = { usedKB: 0, totalKB: 5120, percent: 0, count: 0 };
  open = false;
  showClearConfirm = false;

  constructor(private historyService: HistoryService) {}

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.routes = this.historyService.getAll();
    this.storageInfo = this.historyService.getStorageInfo();
  }

  removeRoute(e: Event, id: string) {
    e.stopPropagation();
    this.historyService.remove(id);
    this.refresh();
  }

  confirmClearAll() {
    this.showClearConfirm = true;
  }

  doClearAll() {
    this.historyService.clearAll();
    this.showClearConfirm = false;
    this.refresh();
  }

  formatSavedAt(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  trackById(_: number, r: SavedRoute) {
    return r.id;
  }
}
