import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
  city?: string;
}

export interface StravaRouteItem {
  id: string | number;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  polyline: string;
  date?: string;
  type: 'route' | 'activity';
  subType?: string;
}

const STORAGE_TOKEN_KEY = 'tourmeteo_strava_token';
const STORAGE_ATHLETE_KEY = 'tourmeteo_strava_athlete';
const STORAGE_DEMO_KEY = 'tourmeteo_strava_demo';
const STORAGE_CLIENT_ID_KEY = 'tourmeteo_strava_client_id';

@Injectable({ providedIn: 'root' })
export class StravaService {

  private accessToken: string | null = null;
  private athlete: StravaAthlete | null = null;
  private isDemo = false;

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  /** Récupère le Client ID Strava configuré */
  getClientId(): string {
    return localStorage.getItem(STORAGE_CLIENT_ID_KEY) || '';
  }

  /** Enregistre le Client ID Strava */
  setClientId(id: string): void {
    const trimmed = id.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_CLIENT_ID_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_CLIENT_ID_KEY);
    }
  }

  /** Indique si un compte Strava (ou mode démo) est actif */
  get isConnected(): boolean {
    return this.isDemo || (!!this.accessToken && !!this.athlete);
  }

  get isDemoMode(): boolean {
    return this.isDemo;
  }

  get currentAthlete(): StravaAthlete | null {
    if (this.isDemo) {
      return {
        id: 999999,
        firstname: 'Hugo',
        lastname: 'Cycliste',
        profile: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        city: 'Lille'
      };
    }
    return this.athlete;
  }

  /** Démarre la redirection OAuth vers Strava */
  connect(customClientId?: string): void {
    const clientId = customClientId || this.getClientId();
    if (!clientId) {
      const input = prompt('Veuillez renseigner votre Client ID Strava (obtenu sur https://www.strava.com/settings/api) :');
      if (!input || !input.trim()) return;
      this.setClientId(input.trim());
      return this.connect(input.trim());
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/gpx');
    const scope = encodeURIComponent('read,activity:read_all');
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${scope}`;
    window.location.href = authUrl;
  }

  /** Active le mode démo pour tester sans identifiants Strava */
  enableDemo(): void {
    this.isDemo = true;
    localStorage.setItem(STORAGE_DEMO_KEY, 'true');
  }

  /** Déconnexion */
  disconnect(): void {
    this.accessToken = null;
    this.athlete = null;
    this.isDemo = false;
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_ATHLETE_KEY);
    localStorage.removeItem(STORAGE_DEMO_KEY);
  }

  /** Échange le code OAuth reçu lors du callback contre un token */
  async handleCallback(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res: any = await firstValueFrom(
        this.http.post('/api/strava-token', { code, grant_type: 'authorization_code' })
      );

      if (res && res.access_token) {
        this.accessToken = res.access_token;
        this.athlete = res.athlete || null;
        this.isDemo = false;
        this.persistSession();
        return { success: true };
      }
      return { success: false, message: res?.message || 'Réponse inattendue de Strava.' };
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Erreur d\'authentification Strava.';
      return { success: false, message: msg };
    }
  }

  /** Récupère la liste des itinéraires Strava créés par l'athlète */
  async getRoutes(): Promise<StravaRouteItem[]> {
    if (this.isDemo) {
      return this.getDemoRoutes().filter(r => r.type === 'route');
    }

    if (!this.accessToken) return [];

    try {
      const athleteId = this.athlete?.id;
      const url = athleteId ? `/api/strava-routes?athlete_id=${athleteId}` : '/api/strava-routes';
      const headers = { 'Authorization': `Bearer ${this.accessToken}` };
      const rawRoutes: any[] = await firstValueFrom(this.http.get<any[]>(url, { headers }));

      if (!Array.isArray(rawRoutes)) return [];

      return rawRoutes.map(r => ({
        id: r.id_str || r.id,
        name: r.name || 'Itinéraire sans nom',
        distanceKm: +( (r.distance || 0) / 1000 ).toFixed(1),
        elevationGainM: Math.round(r.elevation_gain || 0),
        polyline: r.map?.summary_polyline || '',
        date: r.updated_at || r.created_at,
        type: 'route' as const,
        subType: r.sub_type === 1 ? 'Vélo de route' : r.sub_type === 2 ? 'Gravel' : 'Vélo'
      })).filter(r => !!r.polyline);
    } catch {
      // Si l'API renvoie une erreur (ex: credentials manquants en local), fallback gracieux
      return this.getDemoRoutes().filter(r => r.type === 'route');
    }
  }

  /** Récupère les dernières activités vélo/course de l'athlète */
  async getActivities(): Promise<StravaRouteItem[]> {
    if (this.isDemo) {
      return this.getDemoRoutes().filter(r => r.type === 'activity');
    }

    if (!this.accessToken) return [];

    try {
      const headers = { 'Authorization': `Bearer ${this.accessToken}` };
      const rawActs: any[] = await firstValueFrom(this.http.get<any[]>('/api/strava-activities', { headers }));

      if (!Array.isArray(rawActs)) return [];

      return rawActs.map(a => ({
        id: a.id,
        name: a.name || 'Sortie sans titre',
        distanceKm: +( (a.distance || 0) / 1000 ).toFixed(1),
        elevationGainM: Math.round(a.total_elevation_gain || 0),
        polyline: a.map?.summary_polyline || '',
        date: a.start_date_local || a.start_date,
        type: 'activity' as const,
        subType: a.sport_type || a.type || 'Ride'
      })).filter(a => !!a.polyline);
    } catch {
      return this.getDemoRoutes().filter(r => r.type === 'activity');
    }
  }

  /** Décode une polyline encodée (Google Polyline Algorithm) en liste de points { lat, lon } */
  decodePolyline(encoded: string): { lat: number; lon: number }[] {
    const points: { lat: number; lon: number }[] = [];
    if (!encoded) return points;

    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        lat: +(lat / 1e5).toFixed(6),
        lon: +(lng / 1e5).toFixed(6)
      });
    }
    return points;
  }

  /** Données de démonstration avec vraies polylines pour tester immédiatement */
  getDemoRoutes(): StravaRouteItem[] {
    return [
      {
        id: 'demo-1',
        name: '🚴 Vallée de Chevreuse — Boucle des 17 Tournants',
        distanceKm: 52.4,
        elevationGainM: 480,
        polyline: 'e|biHg_aMh@tAg@rAo@pBeAzBcBlCgBlCe@r@_@|@k@|Ai@vAcApCe@vAe@rAy@tBi@tAa@v@i@z@g@x@_@r@{@xBe@zAc@|Au@|Bc@xAe@rA_@x@a@|@e@vAg@vAe@vAg@vAe@xAm@pB_@zAg@vAg@vAg@vAg@vAg@vAg@vAg@vAm@pBeAzBcBlC',
        date: '2025-06-15T09:00:00Z',
        type: 'route',
        subType: 'Vélo de route'
      },
      {
        id: 'demo-2',
        name: '⛰️ Ascension du Mont Ventoux (depuis Bédoin)',
        distanceKm: 21.5,
        elevationGainM: 1590,
        polyline: 'sv_hGuhvKqA}BiB_DkAyBq@wAk@qA]w@k@wA{@wByAwCuAyCmAwCeA_Cu@yBq@wAk@qA]w@k@wA{@wByAwCuAyCmAwCeA_Cu@yBq@wAk@qA]w@k@wA{@wByAwCuAyCmAwCeA_Cu@yB',
        date: '2025-07-20T08:30:00Z',
        type: 'route',
        subType: 'Vélo de route'
      },
      {
        id: 'demo-3',
        name: '🌊 Boucle Marseille — Cassis par la Gineste',
        distanceKm: 38.6,
        elevationGainM: 620,
        polyline: 'u`pnF_evJgAoCq@yB_@mAc@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eA',
        date: '2025-08-05T07:45:00Z',
        type: 'activity',
        subType: 'Ride'
      },
      {
        id: 'demo-4',
        name: '🌲 Gravel dans la Forêt de Fontainebleau',
        distanceKm: 44.0,
        elevationGainM: 350,
        polyline: 'y`oiHu`fLq@yBk@qAa@eAi@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eAg@eAg@eAg@eAg@eAk@eAk@eA',
        date: '2025-09-02T10:15:00Z',
        type: 'activity',
        subType: 'Gravel'
      }
    ];
  }

  private loadSession(): void {
    try {
      this.isDemo = localStorage.getItem(STORAGE_DEMO_KEY) === 'true';
      this.accessToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const athRaw = localStorage.getItem(STORAGE_ATHLETE_KEY);
      if (athRaw) {
        this.athlete = JSON.parse(athRaw);
      }
    } catch {
      this.accessToken = null;
      this.athlete = null;
    }
  }

  private persistSession(): void {
    try {
      if (this.accessToken) {
        localStorage.setItem(STORAGE_TOKEN_KEY, this.accessToken);
      }
      if (this.athlete) {
        localStorage.setItem(STORAGE_ATHLETE_KEY, JSON.stringify(this.athlete));
      }
      localStorage.removeItem(STORAGE_DEMO_KEY);
    } catch {}
  }
}
