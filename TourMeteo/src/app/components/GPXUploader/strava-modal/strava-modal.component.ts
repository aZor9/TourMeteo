import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StravaRouteItem, StravaService } from '../../../service/strava.service';

@Component({
  selector: 'app-strava-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './strava-modal.component.html'
})
export class StravaModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() routeSelected = new EventEmitter<{
    name: string;
    points: { lat: number; lon: number }[];
    distanceKm: number;
    departureTime?: string;
  }>();

  activeTab: 'routes' | 'activities' = 'routes';
  searchQuery = '';
  loading = false;
  errorMessage = '';

  routes: StravaRouteItem[] = [];
  activities: StravaRouteItem[] = [];

  constructor(public strava: StravaService) {}

  ngOnInit() {
    if (this.isOpen) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      this.loadData();
    }
  }

  get displayedItems(): StravaRouteItem[] {
    const list = this.activeTab === 'routes' ? this.routes : this.activities;
    if (!this.searchQuery.trim()) return list;
    const q = this.searchQuery.toLowerCase().trim();
    return list.filter(item => item.name.toLowerCase().includes(q));
  }

  async loadData() {
    this.loading = true;
    this.errorMessage = '';
    try {
      if (this.activeTab === 'routes') {
        this.routes = await this.strava.getRoutes();
      } else {
        this.activities = await this.strava.getActivities();
      }
    } catch {
      this.errorMessage = 'Impossible de récupérer les données depuis Strava.';
    } finally {
      this.loading = false;
    }
  }

  async switchTab(tab: 'routes' | 'activities') {
    this.activeTab = tab;
    if (tab === 'routes' && this.routes.length === 0) {
      await this.loadData();
    } else if (tab === 'activities' && this.activities.length === 0) {
      await this.loadData();
    }
  }

  selectItem(item: StravaRouteItem) {
    const points = this.strava.decodePolyline(item.polyline);
    if (points.length < 2) {
      this.errorMessage = 'Ce parcours ne contient pas assez de points GPS exploitables.';
      return;
    }

    let departureTime: string | undefined;
    if (item.date) {
      try {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          departureTime = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }
      } catch {}
    }

    this.routeSelected.emit({
      name: item.name,
      points,
      distanceKm: item.distanceKm,
      departureTime
    });

    this.closeModal();
  }

  closeModal() {
    this.close.emit();
  }
}
