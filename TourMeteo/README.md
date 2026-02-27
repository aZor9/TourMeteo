# TourMeteo

Application Angular de comparaison météo entre plusieurs villes, heure par heure, pensée pour les cyclistes et randonneurs.

## Fonctionnalités

- **Recherche multi-villes** : comparer la météo horaire de plusieurs villes sur une même date
- **Filtres d'affichage** : température, vent, résumé météo (activables/désactivables)
- **Vue mobile optimisée** : cartes avec emoji météo en fond, indicateur jour/nuit, précipitations
- **Import GPX** : charger un fichier `.gpx` pour calculer la distance totale et estimer les horaires de passage
- **Carte interactive** : tracé du parcours GPX sur une carte Leaflet avec marqueurs numérotés par ville
- **Météo par passage** : température, ressenti, vent (vitesse + direction), humidité, probabilité de pluie, précipitations
- **Score de sortie vélo** : score 0-100 avec recommandation de tenue cycliste, alertes et conseils
- **Statistiques résumées** : distance totale, durée estimée, heures de départ/arrivée, nombre de villes
- **Export PNG** : image du tableau des passages avec score vélo + tenue recommandée (rendu Canvas natif)
- **Partage** : via l'API Web Share ou téléchargement automatique
- **Filtres résultats** : bascule Résumé / Détail, masquer/afficher carte, score ou tableau
- **Rafraîchir météo** : changer la date sans re-géocoder les villes
- **Historique local** 🔧 : sauvegarde des trajets en localStorage (fonctionnalité expérimentale, activer dans options dev)
- **Feature Flags** : options dev cachées (tap 5× sur le badge de version dans À propos)
- **Vercel Analytics** : suivi anonyme des performances
- **Page À propos** : sections déroulantes (accordéon), contact intégré

## Stack technique

- **Angular 21** avec composants standalone
- **Tailwind CSS** (CDN)
- **Leaflet** pour les cartes interactives
- **Open-Meteo API** pour les données météo horaires
- **Nominatim / OpenStreetMap** pour le géocodage et reverse-géocodage
- **Vercel Analytics + Speed Insights**

## Architecture des composants

```
src/app/
├── components/
│   ├── App/                        # Page d'accueil (recherche multi-villes)
│   ├── About/                      # Page À propos + options dev cachées
│   ├── GPXUploader/                # Page GPX
│   │   ├── gpx-uploader.component  # Orchestrateur (upload, parsing, météo)
│   │   ├── gpx-map/                # Carte Leaflet (tracé + marqueurs)
│   │   ├── ride-score/             # Score de sortie vélo + tenue
│   │   ├── gpx-summary-bar/        # Barre de statistiques
│   │   ├── gpx-results-table/      # Tableau desktop + cartes mobile
│   │   └── history-panel/          # Panneau historique (dev feature flag)
│   ├── SearchTab/                  # Barre de recherche + filtres
│   ├── WeatherSheet/               # Grille météo horaire par ville
│   └── navbar/                     # Navigation
├── models/
│   └── passage.model.ts            # Interfaces Passage et PassageWeather
├── service/
│   ├── weather.service.ts          # Service Open-Meteo
│   ├── city.service.ts             # Service Nominatim
│   ├── gpx-export.service.ts       # Service export PNG + partage
│   ├── history.service.ts          # Service historique (localStorage CRUD)
│   └── feature-flag.service.ts     # Service feature flags (localStorage)
└── utils/
    └── weather-utils.ts            # Fonctions partagées (weathercode → emoji, etc.)
```

## Développement

```bash
cd TourMeteo
npm install
ng serve
```

Ouvrir `http://localhost:4200/` dans le navigateur.

## Build

```bash
ng build
```

Les fichiers de production seront dans le dossier `dist/`.

## APIs utilisées

| API | Usage |
|-----|-------|
| [Open-Meteo](https://open-meteo.com/) | Données météo horaires (température, vent, précipitations, humidité, weathercode) |
| [Nominatim](https://nominatim.openstreetmap.org/) | Géocodage et reverse-géocodage (lat/lon → ville) |

## Notes

- Le reverse-géocodage Nominatim est throttlé à ~1 requête/seconde avec échantillonnage par distance (~2 km)
- L'export PNG utilise le Canvas API natif, sans dépendance externe
- Leaflet est importé dynamiquement (lazy loading) pour réduire la taille du bundle initial
- L'historique et les feature flags sont stockés en `localStorage` (clés `tourmeteo_history` et `tourmeteo_flags`)
