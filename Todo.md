Fonctionnalités prioritaires:

- Créer une "trace GPX rapide" (mode preview) pour générer un tracé simple et voir la météo sans importer un GPX complet.
- Ajouter un mode "Run" (pas que vélo) — choix de l'unité de vitesse (km/h, min/km, mph) en configuration.
- ~~Filtre d'affichage / résumé : permettre de masquer les détails ou d'afficher un résumé via un menu déroulant pour ne pas surcharger l'UI (tracé vs détail).~~ ✅ Done (v2.2.0) — Résumé/Détail + checkboxes carte/score/tableau

Sauvegarde & historique:

- ~~Enregistrer résultats en `localStorage` pour historique et favoris (sauvegarder points/nom de trace, météo, date). Permettre de changer la date localement sans re-caller l'API de recherche de la ville.~~ ✅ Done (v2.2.0) — HistoryService + HistoryPanelComponent + refreshWeatherOnly
- ~~Ajouter alerte si `localStorage` plein et option pour vider (ou purger les plus anciens). Indiquer taille/compte d'items.~~ ✅ Done (v2.2.0) — barre de stockage, quota alert, purge, max 30 items

Améliorations UI/UX:

- ~~Réorganiser les pages de résultats pour alléger la lecture (espacements, badges, résumé en haut).~~ ✅ Done (v2.1.0) — Redesign complet de la page GPX
- Ajouter option rapide pour basculer unité vitesse (affichage et calculs).

Feature Flags & Options développeur:

- ~~Panneau dev caché dans À propos (tap 5× sur badge version) avec toggles pour historique et features expérimentales, persisté en localStorage.~~ ✅ Done (v2.2.0) — FeatureFlagService + devtools section
- L'historique est gated derrière le flag `history` (désactivé par défaut).

Notes d'implémentation & priorités:

1. Trace GPX rapide (prototype) — permet démo instantanée.
2. ~~localStorage (historique/favoris) + gestion quota.~~ ✅
3. Mode Run + unité vitesse.
4. ~~Filtres d'affichage / résumé.~~ ✅




Nouvelle api qu'on peut intégrer : 
🚴 1. Données segments & perfs : Strava API
🌬️ 2. API vent ultra précise : Windy (API Windy)
🗺️ 3. Données terrain avancées : OpenElevation : Dénivelé exact / Profil altitude par point GPX 
🚦 4. Données trafic vélo : OpenStreetMap Overpass API : Pistes cyclables / Routes dangereuses / Surface (asphalt, gravel, etc.) / Type de voie
🌡️ 5. API météo “ressenti sportif” : Meteostat : Historique météo précise / Analyse comparative passée
🛰️ 6. API solaire (ultra niche) : Sunrise-Sunset.org : Heure lever/coucher soleil précise / Crépuscule / Golden hour
=> Sécurité & Planification 