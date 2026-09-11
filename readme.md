# TourMeteo

Application Angular permettant de comparer la météo heure par heure entre plusieurs villes — outil pensé pour les cyclistes et randonneurs.

**Démo en ligne :** déployé sur [Vercel](https://meteo-ride.vercel.app/) (branche `dev` du repo Github)

---

## Architecture du projet

```
TourMeteo/              ← projet Angular (root directory pour Vercel)
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── App/              Page d'accueil (recherche multi-villes)
│   │   │   ├── About/            Page « À propos » + options dev cachées
│   │   │   ├── GPXUploader/      Import GPX + export PNG / partage
│   │   │   │   ├── gpx-map/      Carte Leaflet (tracé + marqueurs)
│   │   │   │   ├── ride-score/   Score vélo + tenue
│   │   │   │   ├── gpx-summary-bar/  Barre de stats
│   │   │   │   ├── gpx-results-table/ Tableau + cartes mobile
│   │   │   │   └── history-panel/     Panneau historique (dev flag)
│   │   │   ├── SearchTab/        Formulaire de recherche
│   │   │   ├── WeatherSheet/     Tableau météo horaire
│   │   │   └── navbar/           Barre de navigation
│   │   ├── service/
│   │   │   ├── city.service.ts        Géocodage (Nominatim)
│   │   │   ├── weather.service.ts     Météo horaire (Open-Meteo)
│   │   │   ├── gpx-export.service.ts  Export PNG + partage
│   │   │   ├── history.service.ts     Historique localStorage
│   │   │   └── feature-flag.service.ts Feature flags localStorage
│   │   ├── app.routes.ts         Routes : /, /about, /gpx
│   │   ├── app.config.ts         Configuration Angular
│   │   └── root.component.ts     Composant racine (router-outlet)
│   └── index.html
├── angular.json
├── vercel.json                   Config Vercel (rewrites SPA)
├── package.json
└── tsconfig*.json
Dockerfile              ← développement Docker (ng serve)
docker-compose.yml
readme.md               ← ce fichier
```

---

## APIs utilisées

| API | Usage | Clé requise | Documentation |
|-----|-------|-------------|---------------|
| **Open-Meteo** | Données météo horaires (température, vent, weathercode, jour/nuit) | Non | https://open-meteo.com/en/docs |
| **Nominatim** (OpenStreetMap) | Géocodage (nom → lat/lon) et reverse-géocodage (lat/lon → ville) | Non | https://nominatim.org/release-docs/latest/ |

> **Note :** Nominatim applique des limites d'usage (1 req/s, user-agent obligatoire). L'application utilise un throttle et un échantillonnage par distance pour respecter ces limites.

---

## Fonctionnalités

### Recherche multi-villes
- Saisir plusieurs villes séparées par des virgules et une date
- Affichage d'un tableau météo horaire comparatif (température, vent, weathercode avec emoji)
- Filtres : température, vent, résumé météo
- **Vue mobile** : cartes avec emoji météo en fond (opacité élevée), indicateur jour/nuit sous l'heure, affichage des précipitations (probabilité + quantité)

### Import GPX et export
- **Import :** charger un fichier `.gpx` pour calculer la distance totale du parcours
- **Connexion Strava 🚴 :** importer directement ses itinéraires enregistrés ou ses activités récentes en 1 clic (authentification OAuth 2.0 ou mode démo)
- **Calcul d'itinéraire :** estimation de l'heure de passage à chaque point selon la vitesse moyenne et l'heure de départ renseignées
- **Reverse-géocodage :** détection automatique de la ville à chaque point d'échantillonnage (Nominatim, throttlé ~1 req/s)
- **Météo par passage :** température, ressenti, vent (vitesse + direction cardinale), humidité, probabilité de pluie, précipitations et emoji weathercode
- **Score de sortie vélo :** score 0-100 avec recommandation de tenue cycliste, alertes et conseils
- **Export PNG :** image soignée du tableau des passages avec score vélo + tenue recommandée (rendu Canvas natif)
- **Partage :** via l'API Web Share sur les navigateurs compatibles ; fallback téléchargement si non supporté
- **Filtres résultats :** bascule Résumé / Détail, masquer/afficher carte, score ou tableau individuellement
- **Rafraîchir météo 🔧 :** changer la date ou l'heure sans re-géocoder les villes (fonctionnalité dev, activer dans options développeur)

### Fonctionnalités supplémentaires ✨
- **Historique des trajets** : sauvegarde en `localStorage` avec rechargement rapide, gestion du quota
- **Carte interactive** : tracé du parcours GPX sur une carte Leaflet avec marqueurs numérotés
- **Villes récentes** 📍 : mémorisation locale des villes recherchées et suggestions automatiques
- **Plan nutritionnel d'effort** 🍌 : estimation des glucides et de l'hydratation (avec avertissement santé)
- **Rafraîchir météo** 🔄 : changer la date ou l'heure sans re-géocoder les villes
- Fonctionnalités supplémentaires, activables dans la section « Fonctionnalités » de la page À propos

### Options développeur (feature flags)
- Panneau caché dans la page À propos : taper 5× sur le badge de version pour le révéler
- **Rafraîchir météo** : changer la date/heure sans re-géocoder les villes (fonctionnalité spéciale dev)
- Toutes les préférences sont persistées en `localStorage`

### Analytics
- **Vercel Analytics** et **Speed Insights** intégrés (suivi anonyme)

### Légende weathercode (Open-Meteo)
| Emoji | Codes | Description |
|-------|-------|-------------|
| ☀️ | 0 | Ciel clair |
| 🌤️ | 1, 2 | Partiellement nuageux |
| ☁️ | 3 | Couvert |
| 🌫️ | 45, 48 | Brouillard |
| 🌦️ | 51, 53, 55, 80, 81, 82 | Bruine / Averses |
| 🌧️ | 56, 57, 61, 63, 65, 66, 67 | Pluie / Bruine verglaçante |
| ❄️ | 71, 73, 75, 77 | Neige / Grains de neige |
| 🌨️ | 85, 86 | Averses de neige |
| ⛈️ | 95, 96, 99 | Orage (avec/sans grêle) |

---

## Installation et lancement

### Prérequis
- Node.js ≥ 18
- npm (inclus avec Node.js)
- Angular CLI (optionnel) : `npm install -g @angular/cli`

### Développement local

```bash
cd TourMeteo
npm install
npm start           # ng serve → http://localhost:4200
```

### Mode watch (rebuild automatique)

```bash
cd TourMeteo
npm run watch
```

### Build production

```bash
cd TourMeteo
npm run build       # ng build --configuration production → dist/
```

### Docker (développement)

```bash
docker compose build
docker compose up
# → http://localhost:4200
```

---

## Déploiement sur Vercel

Le projet est configuré pour un déploiement automatique depuis GitHub (branche `dev`).

### Configuration Vercel (Project Settings)
| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `TourMeteo` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### Fichier `vercel.json` (dans `TourMeteo/`)
```json
{
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Le rewrite SPA redirige toutes les routes vers `index.html` pour que le router Angular gère la navigation côté client (`/about`, `/gpx`, etc.).

---

## Améliorations possibles
- Création rapide de trace GPX directement dans l'app (mode preview)
- Mode "Run" (pas que vélo) — choix unité de vitesse (km/h, min/km, mph)
- Notifications météo (alertes pluie/orage)
- Accessibilité améliorée (ARIA, contraste)
- Proxy serveur pour Nominatim (cache + throttle en production)
- Intégration Strava API (segments, données de performance)
- Données vent avancées (Windy, Meteomatics)
- Profil d'altitude (OpenElevation)

---

## Difficultés rencontrées
- Transmission des coordonnées lat/lon à l'API météo (résolu via `CityService`)
- Limites de requêtes Nominatim (résolu via throttle et échantillonnage par distance)
- Configuration du déploiement Vercel pour un projet Angular dans un sous-dossier (résolu via `outputPath` dans `angular.json` et `vercel.json`)

---

## Contact / Crédits
- Repo : https://github.com/aZor9/TourMeteo
- Site : https://meteo-ride.vercel.app/ 
- Créateur : Hugo Lembrez