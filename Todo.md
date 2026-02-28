Fonctionnalités prioritaires:

- Créer une "trace GPX rapide" (mode preview) pour générer un tracé simple et voir la météo sans importer un GPX complet.
- Ajouter un mode "Run" (pas que vélo) — choix de l'unité de vitesse (km/h, min/km, mph) en configuration.


Améliorations UI/UX:

- Ajouter option rapide pour basculer unité vitesse (affichage et calculs).
- Page d'accueil en vrai page d'accueil avec une page daily pour la page d'accueil actuelle, et la page gpx en page Ride.
- Dans le menu en mobile, il faut un écart un peu plus grand entre le bouton du haut et le haut de la navbar.


Notes d'implémentation & priorités:
- Mode Run + unité vitesse.
- Gestion de plan nutrition pendant effort.
- Gestion du meilleur horaire de départ d'un gpx dans une journée (voir rate limite à l'api météo).
- Gestion de parcours.


Idée pour une version 3 ou 4 :
Nouvelle api qu'on peut intégrer :
🚴 1. Données segments & perfs : Strava API
🌬️ 2. API vent ultra précise : Windy (API Windy)
🗺️ 3. Données terrain avancées : OpenElevation : Dénivelé exact / Profil altitude par point GPX
🚦 4. Données trafic vélo : OpenStreetMap Overpass API : Pistes cyclables / Routes dangereuses / Surface (asphalt, gravel, etc.) / Type de voie
🌡️ 5. API météo "ressenti sportif" : Meteostat : Historique météo précise / Analyse comparative passée
🛰️ 6. API solaire (ultra niche) : Sunrise-Sunset.org : Heure lever/coucher soleil précise / Crépuscule / Golden hour
=> Sécurité & Planification
