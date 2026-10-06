import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WeatherService, NowWeather } from '../../service/weather.service';
import { CityService } from '../../service/city.service';
import { RecentCitiesService } from '../../service/recent-cities.service';
import { FeatureFlagService, FeatureFlags } from '../../service/feature-flag.service';
import { getWeatherDescription, degreesToCardinal } from '../../utils/weather-utils';

interface Place { name: string; lat: number; lon: number; }

interface FeatureCard {
  link: string;
  icon: string;
  title: string;
  text: string;
  flag?: keyof FeatureFlags;
}

const PLACE_KEY = 'tourmeteo_home_place';

const CARDS: FeatureCard[] = [
  { link: '/hourly', icon: '📈', title: 'Graphiques', text: 'Pluie, vent, UV et qualité de l\'air heure par heure, en graphiques.', flag: 'hourly' },
  { link: '/daily', icon: '📅', title: 'Daily', text: 'Comparez la météo de plusieurs villes sur une même journée.' },
  { link: '/gpx', icon: '🚴', title: 'Ride', text: 'Importez un parcours : météo à chaque passage, score de sortie et tenue conseillée.' },
  { link: '/best-departure', icon: '⏰', title: 'Meilleur départ', text: 'Trouvez l\'heure de départ idéale pour votre parcours.', flag: 'bestDeparture' },
  { link: '/route-creator', icon: '🛤️', title: 'Créer un parcours', text: 'Générez une boucle vélo ou running et exportez-la en GPX.', flag: 'routeCreator' },
  { link: '/run', icon: '🏃', title: 'Running', text: 'Météo, nutrition et vêtements pour votre sortie à pied.', flag: 'running' }
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  city = '';
  place: Place | null = null;
  now: NowWeather | null = null;
  loading = false;
  geoLoading = false;
  error = '';
  verdict = '';
  maxRain = 0.5;

  getWeatherDescription = getWeatherDescription;
  degreesToCardinal = degreesToCardinal;

  constructor(
    private weather: WeatherService,
    private cities: CityService,
    private recent: RecentCitiesService,
    private ff: FeatureFlagService,
    private cd: ChangeDetectorRef
  ) {}

  get cards(): FeatureCard[] {
    return CARDS.filter(c => !c.flag || this.ff.isEnabled(c.flag));
  }

  get hourlyEnabled(): boolean { return this.ff.isEnabled('hourly'); }

  get recentChips(): string[] { return this.recent.getAll().slice(0, 5); }

  ngOnInit(): void {
    try {
      const raw = localStorage.getItem(PLACE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Place;
        if (p && typeof p.name === 'string' && isFinite(p.lat) && isFinite(p.lon)) {
          this.place = p;
          this.city = p.name === 'Ma position' ? '' : p.name;
          void this.refresh();
        }
      }
    } catch { /* localStorage indisponible : on affiche l'état vide */ }
  }

  async searchCity(name = this.city): Promise<void> {
    const q = name.trim();
    if (!q) return;
    this.city = q;
    this.loading = true;
    this.error = '';
    try {
      const g = await this.cities.getLatLon(q);
      this.recent.add(q);
      this.setPlace({ name: q, lat: +g.lat, lon: +g.lon });
    } catch {
      this.loading = false;
      this.error = 'Lieu introuvable. Essayez un autre nom de ville.';
    }
    this.cd.detectChanges();
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.error = 'La géolocalisation n\'est pas disponible sur cet appareil.';
      return;
    }
    this.geoLoading = true;
    this.error = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.geoLoading = false;
        this.city = '';
        this.setPlace({ name: 'Ma position', lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) });
      },
      () => {
        this.geoLoading = false;
        this.error = 'Position refusée ou indisponible.';
        this.cd.detectChanges();
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  private setPlace(p: Place): void {
    this.place = p;
    try { localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* quota : tant pis */ }
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.place) return;
    this.loading = true;
    this.error = '';
    this.cd.detectChanges();
    try {
      this.now = await this.weather.getNow(this.place.lat, this.place.lon);
      this.maxRain = Math.max(0.5, ...this.now.next.map(h => h.precipitation));
      this.verdict = this.buildVerdict(this.now);
    } catch {
      this.error = 'Impossible de récupérer la météo pour le moment.';
    } finally {
      this.loading = false;
      this.cd.detectChanges();
    }
  }

  barHeight(mm: number): number {
    return mm <= 0 ? 0 : Math.max(8, Math.round((mm / this.maxRain) * 100));
  }

  /** Phrase de synthèse pour la sortie à venir */
  private buildVerdict(n: NowWeather): string {
    const rain = n.next.find(h => h.precipitation >= 0.3 || h.probability >= 60);
    if (rain) {
      const delta = (rain.hour - new Date().getHours() + 24) % 24;
      return delta === 0 ? '🌧️ Pluie en cours ou imminente' : `🌧️ Pluie probable dans ${delta} h (vers ${rain.hour}h)`;
    }
    if ((n.gust ?? n.wind) >= 40) return '💨 Vent fort : prudence, surtout à vélo';
    if (n.apparent <= 5) return '🧤 Frais : prévoyez des couches chaudes';
    if (n.apparent >= 30) return '🥵 Chaleur : emportez de l\'eau en plus';
    return '👍 Bonnes conditions pour sortir dans les prochaines heures';
  }
}
