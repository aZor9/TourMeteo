projet : 


cela affichera un tableau, en ligne : les villes, en colone : les heures, et en donnée : la temperature, le vent et la météo globale.

## TourMeteo – Application météo pour cyclistes

### Objectif du projet
Démo des compétences Angular à travers une application météo multi-villes, pensée pour les cyclistes.

### Outils utilisés
- Angular
- Tailwind CSS
- API Nominatim (géocodage)
- API Open-Meteo (prévisions météo)

### Résumé
TourMeteo permet de visualiser, pour une journée donnée, la météo de plusieurs villes en un coup d'œil. L'interface cible les cyclistes souhaitant planifier une sortie sur plusieurs localités.

### Fonctionnalités principales
- Sélection de plusieurs villes et d'une date spécifique
- Choix des données à afficher (température, vent, météo globale)
- Affichage sous forme de tableau croisé :
	- Lignes : heures de la journée
	- Colonnes : villes sélectionnées
	- Cellules : température, vent, météo (avec emoji et description)

### User Story
L'utilisateur saisit une ou plusieurs villes et choisit une date. Il sélectionne les données météo à afficher. L'application présente un tableau : chaque colonne correspond à une ville, chaque ligne à une heure, chaque cellule affiche les infos météo pour ce créneau.

### APIs utilisées
- **Nominatim** : conversion ville → latitude/longitude
- **Open-Meteo** : prévisions météo horaires par coordonnées

### Exemple de fonctionnement
1. L'utilisateur tape “Montpellier”
2. L'application interroge Nominatim pour obtenir les coordonnées
3. L'application interroge Open-Meteo pour récupérer la météo détaillée
4. Les résultats sont affichés dans le tableau croisé