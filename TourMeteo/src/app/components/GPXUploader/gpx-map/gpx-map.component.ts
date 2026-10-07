import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Passage } from '../../../models/passage.model';

@Component({
  selector: 'app-gpx-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div #mapContainer id="gpx-map" style="height: 350px; width: 100%; z-index: 0;"></div>
    </div>
  `
})
export class GpxMapComponent implements OnChanges {
  @Input() passages: Passage[] = [];
  @Input() points: Array<{ lat: number; lon: number }> = [];

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private map: any = null;

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['passages'] || changes['points']) && this.passages.length > 0) {
      this.renderMap();
    }
  }

  async renderMap() {
    const L = (await import('leaflet')).default || await import('leaflet');

    // Fix default marker icons for Angular
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Destroy previous map instance
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const container = this.mapContainer?.nativeElement;
    if (!container) return;

    this.map = L.map(container);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Draw full route polyline
    if (this.points.length > 1) {
      const routeLatLngs = this.points.map(p => L.latLng(p.lat, p.lon));
      L.polyline(routeLatLngs, { color: '#4F46E5', weight: 4, opacity: 0.8 }).addTo(this.map);
    }

    // Add numbered circle markers
    const bounds: any[] = [];
    this.passages.forEach((p, idx) => {
      const latlng = L.latLng(p.lat, p.lon);
      bounds.push(latlng);
      L.circleMarker(latlng, {
        radius: 14,
        fillColor: '#4F46E5',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(this.map);

      const numberIcon = L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#4F46E5;color:#fff;font-weight:bold;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${idx + 1}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker(latlng, { icon: numberIcon }).addTo(this.map)
        .bindPopup(`<b>${idx + 1}. ${p.city}</b><br>${p.distanceKm} km`);
    });

    if (bounds.length > 0) {
      this.map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
  }
}
