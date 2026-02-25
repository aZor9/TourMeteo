# TourMeteo

Application Angular de comparaison météo entre plusieurs villes, heure par heure, pensée pour les cyclistes et randonneurs.

## Fonctionnalités

- **Recherche multi-villes** : comparer la météo horaire de plusieurs villes sur une même date
- **Filtres d'affichage** : température, vent, résumé météo (activables/désactivables)
- **Import GPX** : charger un fichier `.gpx` pour calculer la distance totale et estimer les horaires de passage
- **Carte interactive** : tracé du parcours GPX sur une carte Leaflet avec marqueurs numérotés par ville
- **Météo par passage** : température, ressenti, vent (vitesse + direction), humidité, probabilité de pluie, quantité de précipitations
- **Score de sortie vélo** : score 0-100 basé sur les conditions météo, avec recommandation de tenue cycliste, alertes et conseils
- **Statistiques résumées** : distance totale, durée estimée, heures de départ/arrivée, nombre de villes traversées
- **Export PNG** : génération d'image PNG (rendu Canvas natif, sans librairie externe)
- **Partage** : via l'API Web Share sur navigateurs compatibles ; téléchargement automatique sinon

## Stack technique

- **Angular 21** avec composants standalone
- **Tailwind CSS** (CDN)
- **Leaflet** pour les cartes interactives
- **Open-Meteo API** pour les données météo horaires
- **Nominatim / OpenStreetMap** pour le géocodage et reverse-géocodage

## Architecture des composants

```
src/app/
├── components/
│   ├── App/                        # Page d'accueil (recherche multi-villes)
│   ├── About/                      # Page À propos
│   ├── GPXUploader/                # Page GPX
│   │   ├── gpx-uploader.component  # Orchestrateur (upload, parsing, météo)
│   │   ├── gpx-map/                # Carte Leaflet (tracé + marqueurs)
│   │   ├── ride-score/             # Score de sortie vélo + tenue
│   │   ├── gpx-summary-bar/        # Barre de statistiques
│   │   └── gpx-results-table/      # Tableau desktop + cartes mobile
│   ├── SearchTab/                  # Barre de recherche + filtres
│   ├── WeatherSheet/               # Grille météo horaire par ville
│   └── navbar/                     # Navigation
├── models/
│   └── passage.model.ts            # Interfaces Passage et PassageWeather
├── service/
│   ├── weather.service.ts          # Service Open-Meteo
│   ├── city.service.ts             # Service Nominatim
│   └── gpx-export.service.ts       # Service export PNG + partage
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
