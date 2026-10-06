New features : 
- systeme de langues differente
- Faire que la touche entrée passe à l'élément suivant ou valide
- Limite horaire min et max dans départ a regarder 
- Trace création gpx : éviter de faire demi tour

Améliorations UI/UX:
- Ajouter option rapide pour basculer unité vitesse (affichage et calculs).
- Page d'accueil en vrai page d'accueil avec une page daily pour la page d'accueil actuelle, et la page gpx en page Ride

Idée futur :
🚴 Données segments & perfs : API Strava API

---

# Backlog priorisé (revue du projet — octobre 2026)

## ✅ Fait dans cette revue
- [x] Nouvelle page d'accueil `/` (météo du moment + 12 h, verdict, lieux récents, cartes vers les fonctionnalités) ; l'ancienne accueil multi-villes devient `/daily` ; routes en lazy loading (bundle initial 612 → 376 kB)
- [x] Feature flag `hourly` (activé par défaut, À propos → Fonctionnalités) + guard de route
- [x] `/hourly` enrichie : rafales, UV, nuages, pression, point de rosée, visibilité, lever/coucher, qualité de l'air (PM, indice européen) et pollens, bandes nuit + ligne « maintenant », lieux récents
- [x] Fuseau horaire : `timezone=auto` sur les appels Open-Meteo (les heures étaient en GMT, décalées de 1-2 h en France)
- [x] Page `/hourly` : météo d'un lieu sur une journée en graphiques (pluie + proba, température/ressenti, vent), bouton « Ma position », jour précédent/suivant, URL partageable `?city=…&date=…`
- [x] Strava : Client ID servi par `/api/strava-config` (plus de `prompt()`), paramètre OAuth `state` (anti-CSRF), refresh automatique du token (expire toutes les 6 h), erreurs réelles affichées (plus de bascule silencieuse sur les données démo), gestion du refus d'autorisation
- [x] API Strava : fonctions en CommonJS (`module.exports`), plus de CORS `*`, `athlete_id` validé (anti path-injection), `grant_type` en liste blanche, token uniquement via header `Authorization`, timeouts, `Cache-Control: no-store`
- [x] `vercel.json` : HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- [x] PWA : `theme_color`/`background_color`/`lang`/`shortcuts` dans le manifest, balises iOS, cache SW des appels Open-Meteo (réseau d'abord, repli cache = utile en montagne) et Nominatim (30 j)
- [x] `index.html` : `lang="fr"`, doublon de police supprimé, config Tailwind externalisée

## ⚡ Performance (fait)
- [x] Logo 432 Ko → 8 Ko dans la navbar (icônes 64/192/512 px), manifest corrigé
- [x] Cache `immutable` d'un an sur les fichiers hashés (main/chunk/styles), 7 jours sur logos et polices
- [x] Tailwind compilé au lieu du CDN (CSS 10 Ko transférés, aucun script tiers bloquant)

## 🔴 Sécurité — à faire
- [ ] **Vérifier sur Vercel** : `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` définis (Production **et** Preview), et « Authorization Callback Domain » = `meteo.hugo-lembrez.fr` dans https://www.strava.com/settings/api. Sans ça, Strava ne marchera jamais.
- [ ] Tokens Strava en `localStorage` : lisibles par n'importe quel script de la page (XSS). Cible : le serveur échange le code et pose le refresh token dans un cookie `HttpOnly; Secure; SameSite=Lax`, le front ne voit jamais de token.
- [x] CDN Tailwind remplacé par Tailwind v3 compilé au build (plus de flash de page sans style, plus de script tiers ; retirer `'unsafe-inline'` de la CSP reste à faire)
- [ ] Durcir davantage la CSP (hash/nonce) une fois Tailwind compilé ; tester avec `Content-Security-Policy-Report-Only` d'abord
- [ ] Rate limiting des fonctions `/api/*` (Vercel WAF / Upstash Ratelimit)
- [x] Angular 21.1.3 → 21.2.25 + `npm audit fix` : **0 vulnérabilité en production** (restent 9 alertes dans des outils de dev non embarqués : CLI, chokidar de Tailwind…)
- [ ] Adapter la date d'expiration de `public/.well-known/security.txt` (créé, expire 2027-10-06)
- [x] Parsing GPX : 15 Mo max, fichier invalide détecté, coordonnées hors limites écartées
- [ ] `User-Agent` dans `CityService` : ignoré par les navigateurs (header interdit). Pour respecter la politique Nominatim, passer par un proxy `/api/geocode` avec cache + vrai User-Agent (retire aussi l'email du bundle front)

## 📊 Stats / observabilité (outils externes)
Déjà présents : Vercel Analytics + Speed Insights.
- [ ] **Événements personnalisés Vercel Analytics** (`track('gpx_import')`, `track('strava_connect')`, `track('hourly_view')`) — 0 dépendance en plus (`@vercel/analytics` exporte `track`)
- [ ] **Sentry** (plan gratuit) : erreurs JS + traces, `@sentry/angular`, source maps → on saura enfin ce qui plante sur les téléphones des autres
- [ ] **Umami** (self-host) / **Plausible** / **GoatCounter** : alternatives analytics respectueuses de la vie privée, sans bandeau cookies
- [ ] **Microsoft Clarity** (gratuit) : heatmaps et replays de sessions mobiles — attention RGPD (bandeau consentement requis)
- [ ] **UptimeRobot / Better Stack** : ping du site et de `/api/strava-config` toutes les 5 min
- [ ] **PageSpeed Insights / Lighthouse CI** dans GitHub Actions : suivi perf + accessibilité + PWA à chaque push
- [ ] **Open-Meteo** propose une clé API commerciale : à envisager si le trafic dépasse le quota gratuit (10 000 appels/jour)

## 📱 Mobile / PWA
- [ ] Icône dédiée 192×192 et 512×512 + vraie icône *maskable* (avec marge de sécurité) — actuellement `logo.png` sert pour tout
- [ ] Bandeau « Nouvelle version disponible » (`SwUpdate.versionUpdates`) : sinon la PWA installée reste sur l'ancienne version jusqu'au 2ᵉ lancement
- [ ] Bouton « Installer l'app » (`beforeinstallprompt`) + explication iOS (Partager → Sur l'écran d'accueil)
- [ ] Mode hors-ligne explicite : afficher « dernières données du … » quand le réseau tombe
- [ ] Pull-to-refresh sur la météo, safe-area iOS (`env(safe-area-inset-*)`) pour la navbar
- [ ] Notifications push « pluie dans 1 h sur ton trajet » (Web Push + cron Vercel)
- [ ] Geolocation sur l'accueil et le créateur de parcours (le bouton existe maintenant sur `/hourly`)
- [ ] Partage via Web Share Target (recevoir un `.gpx` depuis une autre app)

## 🌦️ Nouvelles fonctionnalités météo
- [ ] Sur `/hourly` : bande jour/nuit en fond des graphiques, rafales de vent, UV, indice de visibilité, direction du vent (flèches), comparaison de 2 lieux sur le même graphique
- [ ] Heure actuelle matérialisée (ligne verticale) sur les graphiques quand la date = aujourd'hui
- [ ] Vent de face / de dos selon la direction du parcours GPX (très utile à vélo)
- [ ] Alertes Météo-France (vigilance) via l'API open data
- [ ] Radar de pluie (RainViewer API) sur la carte Leaflet
- [ ] Prévision sur plusieurs jours (graphique 7 jours)
- [ ] Unités : °C/°F, km/h / m/s / mph, mm / in (voir « unité vitesse » plus haut)
- [ ] Profil d'altitude + dénivelé dans la page GPX (Open-Meteo elevation déjà utilisée côté route creator)

## 🧱 Qualité du code / dette technique
- [ ] `App` (accueil) est déclaré avec `selector: 'app-root'` alors que `RootComponent` l'utilise aussi → renommer en `app-daily`
- [ ] Beaucoup de `ChangeDetectorRef.detectChanges()` manuels : migrer vers les **signals** (Angular 21) et `@if/@for` à la place de `*ngIf/*ngFor`
- [ ] Composants énormes (`route-creator` 650 l., `gpx-uploader` 530 l.) → extraire la logique dans des services
- [ ] Typage : remplacer les `any` (réponses Open-Meteo, Strava) par des interfaces
- [ ] Lazy loading de toutes les routes (`loadComponent`), pas seulement `/hourly`
- [ ] Mutualiser le reverse-géocodage Nominatim (copié dans 3 composants) dans `CityService`
- [ ] Un service `localStorage` commun (try/catch + versioning des clés)
- [ ] Tests : `app.spec.ts` seul pour l'instant → tests Vitest sur `weather-utils`, `decodePolyline`, parsing GPX, ride-score
- [ ] CI GitHub Actions : `npm ci && ng build && ng test` sur chaque PR (branche `dev` → `main`)
- [x] Version : source unique = `package.json` (2.3.0), lue par la page À propos et les `User-Agent`
- [ ] `Dockerfile` : image `node:20` OK, ajouter `.dockerignore` (`node_modules`, `dist`)
- [ ] Environnement local : `vercel dev` pour tester `/api/*` (ou proxy dans `ng serve`), sinon Strava ne peut pas marcher en local

## ♿ Accessibilité
- [ ] Contraste du texte `#A09589` sur fond clair < 4.5:1 → assombrir
- [ ] Mode sombre : Tailwind `dark:` est partiellement configuré mais la charte est claire uniquement
- [ ] Labels ARIA sur la navbar mobile, focus piégé dans les modales (Strava)
- [ ] Alternative textuelle pour chaque graphique (résumé déjà présent sur `/hourly`)

## 🚴 Strava (quand le reste est stable)
- [ ] Segments favoris + temps de passage estimé
- [ ] Import automatique de la dernière sortie planifiée
- [ ] Respecter les « Strava API Brand Guidelines » (logo « Powered by Strava », bouton officiel « Connect with Strava »)
- [ ] Webhooks Strava pour détecter les nouvelles activités
