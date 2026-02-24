# TourMeteo

Application Angular permettant de comparer la météo heure par heure entre plusieurs villes — outil pensé pour les cyclistes.

---

## Architecture du projet
- Projet Angular complet — dossier racine `TourMeteo/`
- Document texte (ce `readme.md`) listant : membres, API, instructions de lancement
- Fichiers auxiliaires : `Dockerfile`, `docker-compose.yml` (si présent)

---

## APIs utilisées (avec liens)
- Géocodage : Nominatim (OpenStreetMap) — https://nominatim.org/release-docs/latest/ (aucune clé requise)
- Météo : Open-Meteo — https://open-meteo.com/en/docs (API publique, pas de clé requise)
- Répertoire du projet : https://github.com/aZor9/TourMeteo

---

## Installation — Prérequis
- Node.js : version 18+ recommandée
- npm (ou `pnpm`/`yarn`) : version récente
- Angular CLI (optionnel) : `npm install -g @angular/cli`


Pour démarrer le docker :

```bash
docker compose build 
docker compose up
# ou
docker-compose up --build
```

Actualisation rapide en mode developpement :

```bash
cd .\TourMeteo\
npm run watch
```

---

## Exemples d'utilisation de l'API (Open-Meteo)
- Documentation : https://open-meteo.com/en/docs
- Exemple : requête horaire pour coordonnées lat/lon (voir `weather.service.ts`)

## Remarques sur Nominatim
- Documentation : https://nominatim.org/release-docs/latest/
- Respecter les conditions d'utilisation (limites de requêtes, user-agent, etc.).

---


## Fonctionnalités et améliorations possibles
- Fonctionnalités : sélection multi-villes, tableau horaire, légende `weathercode` (voir `about.html`)
- Améliorations possibles : parcours itinéraire (a mettre en place avec l'aide d'autre API), notifications météo, accessibilité améliorée
- 
- ## Import GPX et export PNG
-
- - Page « Import GPX » : importez un fichier `.gpx` pour calculer la distance et estimer les heures de passage selon une vitesse moyenne et une heure de départ.
- - L'application tente de déterminer la ville à chaque passage (reverse-geocoding), récupère la météo horaire (Open-Meteo) et affiche température, vent et un emoji descriptif.
- - Export / partage : les résultats peuvent être exportés en image PNG ou partagés via l'API Web Share sur les navigateurs compatibles.
-
- - Remarque : Nominatim (OpenStreetMap) applique des limites d'usage et peut bloquer les requêtes CORS. Pour un usage stable en production, déployer un petit proxy serveur (Express) avec cache et throttle est recommandé.
- Affichage plus lisible (couleur de la case en fonction du jour ou de la nuit, grand emoji pour le score météo, ...)
- Mettre l'application web  accessible en ligne

---

## Difficultés rencontrées
- Trouver un moyen de transmettre des longitudes et lattitudes a l'API météo.

---

## Contact / Crédits
- Repo original : https://github.com/aZor9/TourMeteo
- Auteur principal : Hugo Lembrez