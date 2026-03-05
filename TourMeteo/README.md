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
- **Créateur de parcours** 🛤️ : génération d'itinéraires vélo/running via BRouter (routes goudronnées, pas de gravier ni chemin privé), analyse Overpass (types de routes, état de surface, pistes cyclables), export GPX, mode boucle
- **Meilleur horaire de départ** ⏰ : analyse météo heure par heure sur un GPX pour recommander l'heure de départ optimale
- **Course à pied** 🏃 : météo horaire pour une sortie running avec conseils nutrition & vêtements
- **Historique local** ✨ : sauvegarde des trajets en localStorage (fonctionnalité supplémentaire, activer dans À propos > Fonctionnalités)
- **Carte interactive** ✨ : tracé GPX sur carte Leaflet (fonctionnalité supplémentaire, activer dans À propos > Fonctionnalités)
- **Rafraîchir météo** 🔄 : changer la date sans re-géocoder les villes
- **Feature Flags** : toggles publics (historique, carte, rafraîchir) + options dev cachées (tap 5× sur le badge de version dans À propos)
- **Vercel Analytics** : suivi anonyme des performances
- **Page À propos** : sections déroulantes (accordéon), contact intégré

## Stack technique

- **Angular 21** avec composants standalone
- **Tailwind CSS** (CDN)
- **Leaflet** pour les cartes interactives (BSD 2-Clause)
- **Open-Meteo API** pour les données météo horaires
- **Nominatim / OpenStreetMap** pour le géocodage et reverse-géocodage
- **BRouter** pour le routage vélo/running (profils `fastbike` / `trekking`)
- **OSRM** comme moteur de routage en fallback
- **Overpass API** pour l'analyse voirie (types de routes, pistes cyclables, état de surface)
- **CARTO Voyager** pour les tuiles cartographiques du créateur de parcours
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
│   ├── RouteCreator/               # Créateur de parcours (BRouter + OSRM fallback)
│   ├── BestDeparture/              # Meilleur horaire de départ
│   ├── Running/                    # Page course à pied
│   ├── SearchTab/                  # Barre de recherche + filtres
│   ├── WeatherSheet/               # Grille météo horaire par ville
│   └── navbar/                     # Navigation (glassmorphism)
├── models/
│   └── passage.model.ts            # Interfaces Passage et PassageWeather
├── service/
│   ├── weather.service.ts          # Service Open-Meteo
│   ├── city.service.ts             # Service Nominatim
│   ├── gpx-export.service.ts       # Service export PNG + partage
│   ├── history.service.ts          # Service historique (localStorage CRUD)
│   ├── feature-flag.service.ts     # Service feature flags (localStorage)
│   └── recent-cities.service.ts    # Service villes récentes (localStorage)
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

| API | Usage | Licence |
|-----|-------|---------|
| [Open-Meteo](https://open-meteo.com/) | Données météo horaires + API élévation (fallback) | CC BY 4.0 |
| [Nominatim](https://nominatim.openstreetmap.org/) | Géocodage et reverse-géocodage (lat/lon → ville) | ODbL (données OSM) |
| [BRouter](https://brouter.de/) | Routage vélo (`fastbike`) et running (`trekking`) — évite gravier & chemins privés | MIT + données OSM (ODbL) |
| [OSRM](https://project-osrm.org/) | Routage fallback (serveur démo) | BSD 2-Clause + données OSM (ODbL) |
| [Overpass API](https://overpass-api.de/) | Analyse voirie : types de routes, pistes cyclables, état de surface | Données OSM (ODbL) |
| [Open Elevation](https://open-elevation.com/) | Profil altimétrique des itinéraires | Open-source |
| [CARTO](https://carto.com/attributions) | Tuiles carte Voyager (créateur de parcours) | CC BY 3.0 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Tuiles carte standard (carte GPX) + données routières | ODbL |

## Notes

- Le reverse-géocodage Nominatim est throttlé à ~1 requête/seconde avec échantillonnage par distance (~2 km). Un email d'identification est inclus dans chaque requête conformément à la politique d'usage.
- Le serveur OSRM public est un serveur de démonstration — utilisé uniquement en fallback si BRouter est indisponible
- Les tuiles CARTO et OSM requièrent une attribution visible dans la carte (incluse via Leaflet)
- L'export PNG utilise le Canvas API natif, sans dépendance externe
- Leaflet est importé dynamiquement (lazy loading) pour réduire la taille du bundle initial
- L'historique et les feature flags sont stockés en `localStorage` (clés `tourmeteo_history` et `tourmeteo_flags`)
- Aucun compte utilisateur, cookie de tracking ou donnée personnelle n'est stocké côté serveur
- Données cartographiques © OpenStreetMap contributors (ODbL)
