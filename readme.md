# TourMeteo

> ## ⚠️ Information importante sur les branches
>
> **La branche `dev` est la version la plus récente et la plus complète du projet.**
> Elle est actuellement déployée et accessible en ligne : **https://tour-meteo.vercel.app/**
>
> La branche `main` correspond à une version soumise dans le cadre d'un projet en attente de validation externe.
> Son contenu ne sera pas modifié tant que cette validation n'aura pas eu lieu.
>
> **Pour consulter les dernières fonctionnalités (import GPX, export PNG, partage, etc.), basculez sur la branche `dev`.**

---

Application Angular permettant de comparer la météo heure par heure entre plusieurs villes — outil pensé pour les cyclistes.

---

## Architecture du projet
- Projet Angular complet — dossier racine `TourMeteo/`
- Document texte (ce `readme.md`) listant : membres, API, instructions de lancement
- Fichiers auxiliaires : `Dockerfile`, `docker-compose.yml`

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
- Docker (optionnel) : pour lancer le projet via conteneur


### Docker (recommandé)

```bash
docker compose build
docker compose up
# ou
docker-compose up --build
# → http://localhost:4200
```

### Développement local (sans Docker)

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
- Améliorations possibles : parcours itinéraire (à mettre en place avec l'aide d'autres API), notifications météo, accessibilité améliorée
- Affichage plus lisible (couleur de la case en fonction du jour ou de la nuit, grand emoji pour le score météo, …)
- ✅ Application web accessible en ligne (Vercel) — voir la branche `dev`

---

## Difficultés rencontrées
- Trouver un moyen de transmettre des longitudes et latitudes à l'API météo.

---

## Contact / Crédits
- Repo original : https://github.com/aZor9/TourMeteo
- Auteur principal : Hugo Lembrez