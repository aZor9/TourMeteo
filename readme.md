# TourMeteo

Application Angular permettant de comparer la météo heure par heure entre plusieurs villes — outil pensé pour les cyclistes et randonneurs.

**Démo en ligne :** déployé sur [Vercel](https://tour-meteo.vercel.app/) (branche `dev` du repo Github)

---

## Architecture du projet

```
TourMeteo/              ← projet Angular (root directory pour Vercel)
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── App/              Page d'accueil (recherche multi-villes)
│   │   │   ├── About/            Page « À propos »
│   │   │   ├── GPXUploader/      Import GPX + export PNG / partage
│   │   │   ├── SearchTab/        Formulaire de recherche
│   │   │   ├── WeatherSheet/     Tableau météo horaire
│   │   │   └── navbar/           Barre de navigation
│   │   ├── service/
│   │   │   ├── city.service.ts   Géocodage (Nominatim)
│   │   │   └── weather.service.ts Météo horaire (Open-Meteo)
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
- **Calcul d'itinéraire :** estimation de l'heure de passage à chaque point selon la vitesse moyenne et l'heure de départ renseignées
- **Reverse-géocodage :** détection automatique de la ville à chaque point d'échantillonnage (Nominatim, throttlé ~1 req/s)
- **Météo par passage :** température, ressenti, vent (vitesse + direction cardinale), humidité, probabilité de pluie, précipitations et emoji weathercode
- **Score de sortie vélo :** score 0-100 avec recommandation de tenue cycliste, alertes et conseils
- **Export PNG :** image soignée du tableau des passages (rendu Canvas natif, bandeau couleur, colonnes espacées, indicateur jour/nuit, footer branding)
- **Partage :** via l'API Web Share sur les navigateurs compatibles ; fallback téléchargement si non supporté

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
- Création rapide de trace GPX directement dans l'app
- Notifications météo (alertes pluie/orage)
- Accessibilité améliorée (ARIA, contraste)
- Proxy serveur pour Nominatim (cache + throttle en production)

---

## Difficultés rencontrées
- Transmission des coordonnées lat/lon à l'API météo (résolu via `CityService`)
- Limites de requêtes Nominatim (résolu via throttle et échantillonnage par distance)
- Configuration du déploiement Vercel pour un projet Angular dans un sous-dossier (résolu via `outputPath` dans `angular.json` et `vercel.json`)

---

## Contact / Crédits
- Repo : https://github.com/aZor9/TourMeteo
- Site : https://tour-meteo.vercel.app/ 
- Créateur : Hugo Lembrez